// ===================================================================
// gyoza ship — flight test
// 800×600 arcade · inertial drift · time-based thrust frame · soft bounce
// ===================================================================

(() => {
  const W = 800;
  const H = 600;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ----- assets -----
  const sprites = {
    standard: 'assets/default.png',
    fly1:     'assets/fly-1.png',
    fly2:     'assets/fly-2.png',
    fly3:     'assets/fly-3.png',
    dmg1:     'assets/dmg-1.png',
    dmg2:     'assets/dmg-2.png',
    dmg3:     'assets/dmg-3.png',
    dmg4:     'assets/dmg-4.png',
    dmg5:     'assets/dmg-5.png',
  };
  const imgs = {};
  let loaded = 0;
  const total = Object.keys(sprites).length;
  Object.entries(sprites).forEach(([k, src]) => {
    const im = new Image();
    im.onload = () => { loaded++; if (loaded === total) start(); };
    im.src = src;
    imgs[k] = im;
  });

  // ----- world: stars, planets, asteroids -----
  // parchment-tinted soft stars (no harsh white)
  const stars = [];
  const STAR_COLORS = ['#F4ECDC', '#E9D9B8', '#C7B89A', '#A89B7E'];
  for (let i = 0; i < 110; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.18 ? 1.6 : 1,
      c: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2,
      tws: 0.6 + Math.random() * 1.2,
      pdepth: 0.15 + Math.random() * 0.5, // parallax: dimmer/farther stars move less
    });
  }

  // distant planets — decorative, drawn flat behind everything
  const planets = [
    { x: 130, y: 110, r: 26, c: '#3C4D6E', accent: '#566E94' },
    { x: 660, y: 470, r: 38, c: '#4F3C5A', accent: '#7A5F84' },
    { x: 550, y: 140, r: 14, c: '#6B8576', accent: '#94AC9C' },
  ];

  // hazard asteroids — collidable, slowly drift
  const asteroids = [];
  function spawnAsteroids() {
    asteroids.length = 0;
    const positions = [
      { x: 220, y: 340, r: 26 },
      { x: 560, y: 230, r: 22 },
      { x: 390, y: 460, r: 30 },
      { x: 690, y: 380, r: 18 },
      { x: 110, y: 200, r: 20 },
    ];
    positions.forEach(p => {
      asteroids.push({
        x: p.x, y: p.y, r: p.r,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14,
        rot: Math.random() * Math.PI * 2,
        rotS: (Math.random() - 0.5) * 0.6,
        seed: Math.random() * 1000,
      });
    });
  }
  spawnAsteroids();

  // ----- ship -----
  const ship = {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    angle: 0,        // radians; 0 = pointing up
    targetAngle: 0,
    thrust: 0,       // 0..1, ramps with time held
    alive: true,
    explodeStart: 0,
    respawnAt: 0,
    radius: 22,      // collision radius (visual sprite is ~32-ish)
  };

  // physics tuning
  const ACCEL = 520;        // px/s² while thrusting
  const MAX_SPEED = 260;    // soft cap
  const DRAG = 0.55;        // velocity multiplier per second (low = driftier)
  const THRUST_RAMP_UP = 0.6;   // seconds to reach full thrust
  const THRUST_RAMP_DOWN = 0.45;
  const ROTATE_SPEED = 7.0;  // radians/sec toward target
  const BOUNCE = 0.5;
  const RESPAWN_DELAY = 1.6; // seconds after explosion completes

  // ----- input -----
  const keys = new Set();
  const keymap = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (keymap[e.code]) { keys.add(keymap[e.code]); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (keymap[e.code]) { keys.delete(keymap[e.code]); }
  });
  // ensure canvas can receive focus for keyboard
  canvas.tabIndex = 0;
  canvas.addEventListener('click', () => canvas.focus());

  document.getElementById('reset-btn').addEventListener('click', () => {
    resetShip();
    spawnAsteroids();
  });

  // ----- explosion particles (one-shot puff) -----
  const debris = [];
  function spawnDebris(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      debris.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.5,
        age: 0,
        size: 1.5 + Math.random() * 2,
        c: ['#D97757', '#E1A572', '#F4ECDC'][(Math.random() * 3) | 0],
      });
    }
  }

  // ----- helpers -----
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function resetShip() {
    ship.x = W / 2; ship.y = H / 2;
    ship.vx = 0; ship.vy = 0;
    ship.angle = 0; ship.targetAngle = 0;
    ship.thrust = 0;
    ship.alive = true;
    debris.length = 0;
    updateState('idle');
  }

  // ----- state pill -----
  const statePill = document.getElementById('state-pill');
  const stateText = document.getElementById('state-text');
  function updateState(s) {
    statePill.dataset.state = s;
    stateText.textContent = s;
  }

  // ----- HUD elements -----
  const hudX = document.getElementById('hud-x');
  const hudY = document.getElementById('hud-y');
  const hudSpd = document.getElementById('hud-spd');
  const hudHdg = document.getElementById('hud-hdg');
  const hudFrame = document.getElementById('hud-frame');
  const segs = document.querySelectorAll('#frame-readout .seg');

  // ----- hint fade -----
  let hintTimer = 4.5;
  let hintHidden = false;
  const hintEl = document.getElementById('hint');

  // ----- main loop -----
  let lastT = 0;
  function frameLoop(t) {
    if (!lastT) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    render();
    requestAnimationFrame(frameLoop);
  }

  function update(dt) {
    // input vector
    let ix = 0, iy = 0;
    if (keys.has('left'))  ix -= 1;
    if (keys.has('right')) ix += 1;
    if (keys.has('up'))    iy -= 1;
    if (keys.has('down'))  iy += 1;
    const inputting = (ix !== 0 || iy !== 0);

    // hide hint on first input
    if (inputting && !hintHidden) {
      hintEl.classList.add('hide');
      hintHidden = true;
    }
    if (!hintHidden) {
      hintTimer -= dt;
      if (hintTimer <= 0) { hintEl.classList.add('hide'); hintHidden = true; }
    }

    if (ship.alive) {
      if (inputting) {
        const m = Math.hypot(ix, iy) || 1;
        ix /= m; iy /= m;
        // accelerate
        ship.vx += ix * ACCEL * dt;
        ship.vy += iy * ACCEL * dt;
        // face input direction (so thruster points behind)
        ship.targetAngle = Math.atan2(ix, -iy); // 0 = up
        // ramp thrust up
        ship.thrust = clamp(ship.thrust + dt / THRUST_RAMP_UP, 0, 1);
      } else {
        // ramp thrust down
        ship.thrust = clamp(ship.thrust - dt / THRUST_RAMP_DOWN, 0, 1);
      }

      // soft cap
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > MAX_SPEED) {
        const k = MAX_SPEED / sp;
        ship.vx *= k; ship.vy *= k;
      }

      // drag (frame-rate independent)
      const k = Math.pow(DRAG, dt);
      ship.vx *= k; ship.vy *= k;

      // rotate toward target
      ship.angle = lerpAngle(ship.angle, ship.targetAngle, clamp(ROTATE_SPEED * dt, 0, 1));

      // move
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      // soft bounce off edges
      const pad = ship.radius;
      if (ship.x < pad)        { ship.x = pad;       ship.vx = -ship.vx * BOUNCE; }
      else if (ship.x > W-pad) { ship.x = W - pad;   ship.vx = -ship.vx * BOUNCE; }
      if (ship.y < pad)        { ship.y = pad;       ship.vy = -ship.vy * BOUNCE; }
      else if (ship.y > H-pad) { ship.y = H - pad;   ship.vy = -ship.vy * BOUNCE; }

      // asteroid collisions
      for (const a of asteroids) {
        const dx = a.x - ship.x;
        const dy = a.y - ship.y;
        const rr = a.r + ship.radius - 4;
        if (dx*dx + dy*dy < rr*rr) {
          // boom
          ship.alive = false;
          ship.explodeStart = performance.now();
          spawnDebris(ship.x, ship.y);
          updateState('exploded');
          break;
        }
      }

      // state update
      if (Math.hypot(ship.vx, ship.vy) > 8 || ship.thrust > 0.08) {
        updateState('flying');
      } else {
        updateState('idle');
      }
    } else {
      // explosion timing — 5 frames @ 160ms each, then debris linger, then respawn
      const elapsed = (performance.now() - ship.explodeStart) / 1000;
      const explosionDur = 5 * 0.16;
      if (elapsed > explosionDur + 0.4) {
        resetShip();
      }
    }

    // asteroids drift
    for (const a of asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotS * dt;
      if (a.x < a.r)       { a.x = a.r;        a.vx = -a.vx; }
      if (a.x > W - a.r)   { a.x = W - a.r;    a.vx = -a.vx; }
      if (a.y < a.r)       { a.y = a.r;        a.vy = -a.vy; }
      if (a.y > H - a.r)   { a.y = H - a.r;    a.vy = -a.vy; }
    }

    // stars twinkle
    for (const s of stars) s.tw += dt * s.tws;

    // debris update
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.92;
      d.vy *= 0.92;
      if (d.age >= d.life) debris.splice(i, 1);
    }

    updateHUD();
  }

  function updateHUD() {
    hudX.textContent = String(Math.round(ship.x)).padStart(3, '0');
    hudY.textContent = String(Math.round(ship.y)).padStart(3, '0');
    const sp = Math.hypot(ship.vx, ship.vy);
    hudSpd.textContent = sp.toFixed(1).padStart(5, '0');
    // heading: 0° = north, clockwise
    let deg = (ship.angle * 180 / Math.PI + 360) % 360;
    hudHdg.textContent = String(Math.round(deg)).padStart(3, '0') + '°';

    const f = pickFrame();
    hudFrame.textContent = f.label;
    segs.forEach((seg, i) => {
      seg.classList.toggle('on', i < f.level);
      seg.classList.toggle('fast', f.level === 3);
    });
  }

  function pickFrame() {
    if (!ship.alive) return { label: 'damage', level: 0, img: null };
    if (ship.thrust < 0.08) return { label: 'standard', level: 0, img: imgs.standard };
    if (ship.thrust < 0.4)  return { label: 'fly-1 slow',   level: 1, img: imgs.fly1 };
    if (ship.thrust < 0.75) return { label: 'fly-2 mid',    level: 2, img: imgs.fly2 };
    return { label: 'fly-3 fast', level: 3, img: imgs.fly3 };
  }

  function render() {
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1A1B2E');
    grad.addColorStop(0.55, '#22223D');
    grad.addColorStop(1, '#2C2A45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // very faint horizontal wash (warm)
    ctx.fillStyle = 'rgba(217, 119, 87, 0.04)';
    ctx.fillRect(0, H * 0.65, W, H * 0.35);

    // stars (twinkle)
    for (const s of stars) {
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.tw));
      ctx.fillStyle = s.c;
      ctx.globalAlpha = a * s.pdepth * 1.4;
      ctx.fillRect(s.x | 0, s.y | 0, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // planets (decorative, behind everything)
    for (const p of planets) {
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      // crescent accent
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // shadow gradient
      const pg = ctx.createRadialGradient(p.x + p.r * 0.4, p.y + p.r * 0.4, 0, p.x, p.y, p.r);
      pg.addColorStop(0, 'rgba(0,0,0,0)');
      pg.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    // asteroids (chunky pixel rocks)
    for (const a of asteroids) drawAsteroid(a);

    // ship or explosion
    if (ship.alive) {
      const f = pickFrame();
      drawShip(f.img, ship.x, ship.y, ship.angle);
    } else {
      const elapsed = (performance.now() - ship.explodeStart) / 1000;
      const idx = Math.min(4, Math.floor(elapsed / 0.16));
      const im = [imgs.dmg1, imgs.dmg2, imgs.dmg3, imgs.dmg4, imgs.dmg5][idx];
      // explosion stays at last known position, fixed orientation
      drawShip(im, ship.x, ship.y, 0, 1.2);
    }

    // debris
    for (const d of debris) {
      const t = 1 - d.age / d.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size * t, d.size * t);
    }
    ctx.globalAlpha = 1;

    // subtle vignette
    const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.4, W/2, H/2, Math.max(W,H)*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShip(img, x, y, angle, scale = 1) {
    if (!img) return;
    const baseScale = 0.55 * scale; // bring 144px sprite to ~80px on canvas
    const w = img.width * baseScale;
    const h = img.height * baseScale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // chunky procedural asteroid — locked-in shape per seed
  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    const N = 9;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      // deterministic wobble from seed
      const r = a.r * (0.78 + 0.22 * Math.sin(a.seed + i * 1.7) * Math.cos(a.seed * 0.3 + i));
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    // body
    ctx.fillStyle = '#5B5A6E';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    // shadow side
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) {
      const [px, py] = pts[i];
      ctx.lineTo(px + 3, py + 3);
    }
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // highlight
    ctx.fillStyle = '#7F7E92';
    ctx.beginPath();
    ctx.arc(-a.r * 0.3, -a.r * 0.3, a.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // outline
    ctx.strokeStyle = '#1D1F33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function start() {
    canvas.focus();
    requestAnimationFrame(frameLoop);
  }
})();
