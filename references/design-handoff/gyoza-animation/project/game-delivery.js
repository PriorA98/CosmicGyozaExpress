// =====================================================================
// delivery gyoza — across the galaxy
// 800×600 arcade · planets, ingredients, dialogue · cozy delivery loop
// =====================================================================

(() => {
  const W = 800;
  const H = 600;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- ship sprite assets ----------
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
  const planetSrc = (i) => `assets/planets/planet0${i}.png`;

  const imgs = {};
  const planetImgs = [];
  let loaded = 0;
  let total = Object.keys(sprites).length + 10;
  function onLoad() { loaded++; if (loaded === total) start(); }
  Object.entries(sprites).forEach(([k, src]) => {
    const im = new Image();
    im.onload = onLoad;
    im.src = src;
    imgs[k] = im;
  });
  for (let i = 0; i < 10; i++) {
    const im = new Image();
    im.onload = onLoad;
    im.src = planetSrc(i);
    planetImgs.push(im);
  }

  // ---------- world: stars, planets, asteroids, ingredients ----------
  const stars = [];
  const STAR_COLORS = ['#F4ECDC', '#E9D9B8', '#C7B89A', '#A89B7E'];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.18 ? 1.6 : 1,
      c: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2,
      tws: 0.6 + Math.random() * 1.2,
      pdepth: 0.18 + Math.random() * 0.5,
    });
  }

  // planets: image index, position, radius (sprite render), dock radius (collision), name, npc, accent
  // target is mossport (planet03 — blue-green)
  const planets = [
    { img: 3, x: 600, y: 150, r: 60, dock: 78, name: 'mossport',  npc: 'gloop',     accent: '#6FA39A', target: true },
    { img: 5, x: 140, y: 460, r: 48, dock: 60, name: 'lunar-9',   npc: 'nani',      accent: '#C49A6C' },
    { img: 9, x: 480, y: 470, r: 38, dock: 50, name: 'eel-iv',    npc: 'porra-7',   accent: '#9EB6C4' },
    { img: 6, x: 110, y: 120, r: 30, dock: 40, name: 'rust',      npc: 'mr.quench', accent: '#A05C4C' },
  ];

  // asteroid field — clustered along a "ribbon"
  const asteroids = [];
  function spawnAsteroids() {
    asteroids.length = 0;
    // cluster ribbon
    const cluster = [
      { x: 290, y: 280, r: 18 },
      { x: 330, y: 320, r: 22 },
      { x: 370, y: 280, r: 16 },
      { x: 400, y: 340, r: 24 },
      { x: 440, y: 300, r: 14 },
      // strays
      { x: 690, y: 380, r: 20 },
      { x: 250, y: 200, r: 16 },
      { x: 720, y: 280, r: 14 },
    ];
    cluster.forEach(p => {
      asteroids.push({
        x: p.x, y: p.y, r: p.r,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        rot: Math.random() * Math.PI * 2,
        rotS: (Math.random() - 0.5) * 0.5,
        seed: Math.random() * 1000,
      });
    });
  }
  spawnAsteroids();

  // ingredient pickups — floating in space, magnetized when close
  const INGREDIENTS = [
    { key: 'egg',     color: '#ECCC8C', stroke: '#7C5B22', label: 'moon-egg' },
    { key: 'chili',   color: '#C97B5A', stroke: '#6E3520', label: 'star chili' },
    { key: 'dashi',   color: '#E8B69D', stroke: '#7A3F2A', label: 'dashi pearl' },
    { key: 'scallion',color: '#8DA17A', stroke: '#3F5230', label: 'scallion' },
  ];
  const pickups = [];
  function spawnPickups() {
    pickups.length = 0;
    const spots = [
      { x: 220, y: 130, type: 0 },
      { x: 540, y: 380, type: 1 },
      { x: 360, y: 180, type: 2 },
      { x: 200, y: 380, type: 3 },
      { x: 640, y: 320, type: 0 },
    ];
    spots.forEach(s => {
      pickups.push({
        x: s.x, y: s.y, type: s.type,
        bob: Math.random() * Math.PI * 2,
        collected: false,
        magnet: 0,
      });
    });
  }
  spawnPickups();

  // ---------- ship ----------
  const ship = {
    x: W / 2, y: H / 2,
    vx: 0, vy: 0,
    angle: 0,
    targetAngle: 0,
    thrust: 0,
    alive: true,
    explodeStart: 0,
    radius: 22,
  };

  // physics
  const ACCEL = 540;
  const MAX_SPEED = 270;
  const DRAG = 0.55;
  const THRUST_RAMP_UP = 0.6;
  const THRUST_RAMP_DOWN = 0.45;
  const ROTATE_SPEED = 7.0;
  const BOUNCE = 0.5;
  const MAGNET_RADIUS = 60;
  const PICKUP_RADIUS = 24;

  // ---------- input ----------
  const keys = new Set();
  const keymap = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (keymap[e.code]) { keys.add(keymap[e.code]); e.preventDefault(); }
    if (e.code === 'KeyE' && nearTarget && phase === 'flight') { triggerDelivery(); }
  });
  window.addEventListener('keyup', (e) => {
    if (keymap[e.code]) { keys.delete(keymap[e.code]); }
  });
  canvas.tabIndex = 0;
  canvas.addEventListener('click', () => canvas.focus());

  // ---------- explosion ----------
  const debris = [];
  function spawnDebris(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      debris.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.5,
        age: 0,
        size: 1.5 + Math.random() * 2,
        c: ['#D97757', '#E1A572', '#F4ECDC'][(Math.random() * 3) | 0],
      });
    }
  }

  // sparkle particles for pickups
  const sparkles = [];
  function spawnSparkle(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 60;
      sparkles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
        size: 1.5 + Math.random() * 1.5,
        c: color,
      });
    }
  }

  // ---------- helpers ----------
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

  // ---------- state pill ----------
  const statePill = document.getElementById('state-pill');
  const stateText = document.getElementById('state-text');
  function updateState(s) {
    statePill.dataset.state = s;
    stateText.textContent = s;
  }

  // ---------- HUD elements ----------
  const hudX = document.getElementById('hud-x');
  const hudY = document.getElementById('hud-y');
  const hudSpd = document.getElementById('hud-spd');
  const hudHdg = document.getElementById('hud-hdg');
  const radarDist = document.getElementById('radar-dist');
  const segs = document.querySelectorAll('#frame-readout .seg');
  const prompt = document.getElementById('prompt');
  const veil = document.getElementById('descend-veil');
  const commLine = document.getElementById('comm-line');
  const commName = document.getElementById('comm-name');
  const commHandle = document.getElementById('comm-handle');
  const commMood = document.getElementById('comm-mood');
  const commPortrait = document.getElementById('comm-portrait');
  const actPrimary = document.getElementById('act-primary');

  // radar
  const radar = document.getElementById('radar');
  const rctx = radar.getContext('2d');
  rctx.imageSmoothingEnabled = false;

  // ---------- phase / dialogue state machine ----------
  // phases: 'flight' → 'delivering' → 'thanks' → back to 'flight' (next quest)
  let phase = 'flight';
  let nearTarget = false;
  let descendT = 0;

  function setComm({ name, handle, mood, moodColor, line, primary, portraitClass }) {
    commName.textContent = name;
    commHandle.textContent = handle;
    commLine.innerHTML = `<span class="typed">${line}</span>`;
    actPrimary.firstChild.nodeValue = (primary.label + ' ');
    commPortrait.className = 'comm-portrait ' + portraitClass;
    // rebuild ring + mood (commMood ref goes stale, re-query after)
    const letter = (name === 'log' ? 'L' : name[0].toUpperCase());
    commPortrait.innerHTML = `<span class="ring"></span>${letter}<span class="mood">${mood}</span>`;
    const m = commPortrait.querySelector('.mood');
    if (m) m.style.color = moodColor || 'var(--ember)';
  }

  // ---------- main loop ----------
  let lastT = 0;
  function frameLoop(t) {
    if (!lastT) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    render();
    renderRadar();
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

    if (phase === 'flight' && ship.alive) {
      if (inputting) {
        const m = Math.hypot(ix, iy) || 1;
        ix /= m; iy /= m;
        ship.vx += ix * ACCEL * dt;
        ship.vy += iy * ACCEL * dt;
        ship.targetAngle = Math.atan2(ix, -iy);
        ship.thrust = clamp(ship.thrust + dt / THRUST_RAMP_UP, 0, 1);
      } else {
        ship.thrust = clamp(ship.thrust - dt / THRUST_RAMP_DOWN, 0, 1);
      }
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > MAX_SPEED) { const k = MAX_SPEED / sp; ship.vx *= k; ship.vy *= k; }
      const k = Math.pow(DRAG, dt);
      ship.vx *= k; ship.vy *= k;
      ship.angle = lerpAngle(ship.angle, ship.targetAngle, clamp(ROTATE_SPEED * dt, 0, 1));
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      const pad = ship.radius;
      if (ship.x < pad)        { ship.x = pad;       ship.vx = -ship.vx * BOUNCE; }
      else if (ship.x > W-pad) { ship.x = W - pad;   ship.vx = -ship.vx * BOUNCE; }
      if (ship.y < pad)        { ship.y = pad;       ship.vy = -ship.vy * BOUNCE; }
      else if (ship.y > H-pad) { ship.y = H - pad;   ship.vy = -ship.vy * BOUNCE; }

      // collisions with asteroids
      for (const a of asteroids) {
        const dx = a.x - ship.x;
        const dy = a.y - ship.y;
        const rr = a.r + ship.radius - 4;
        if (dx*dx + dy*dy < rr*rr) {
          ship.alive = false;
          ship.explodeStart = performance.now();
          spawnDebris(ship.x, ship.y);
          updateState('exploded');
          break;
        }
      }

      // pickups
      for (const p of pickups) {
        if (p.collected) continue;
        const dx = ship.x - p.x;
        const dy = ship.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET_RADIUS) {
          p.magnet = Math.min(1, p.magnet + dt * 2);
          const pull = p.magnet * 180 * dt;
          p.x += (dx / dist) * pull;
          p.y += (dy / dist) * pull;
        }
        if (dist < PICKUP_RADIUS) {
          p.collected = true;
          spawnSparkle(p.x, p.y, INGREDIENTS[p.type].color);
        }
      }

      // proximity to target planet
      const tp = planets.find(p => p.target);
      const tdx = tp.x - ship.x;
      const tdy = tp.y - ship.y;
      const tdist = Math.hypot(tdx, tdy);
      const inDock = tdist < tp.dock;
      const slow = Math.hypot(ship.vx, ship.vy) < 80;
      nearTarget = inDock && slow;
      prompt.classList.toggle('show', nearTarget);

      // state
      if (Math.hypot(ship.vx, ship.vy) > 8 || ship.thrust > 0.08) {
        updateState(inDock ? 'docking' : 'flying');
      } else {
        updateState(inDock ? 'docking' : 'idle');
      }
    } else if (!ship.alive) {
      const elapsed = (performance.now() - ship.explodeStart) / 1000;
      if (elapsed > 5 * 0.16 + 0.6) resetShip();
    } else if (phase === 'delivering') {
      // glide ship into the planet
      const tp = planets.find(p => p.target);
      const dx = tp.x - ship.x;
      const dy = tp.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        ship.x += (dx / dist) * 70 * dt;
        ship.y += (dy / dist) * 70 * dt;
        ship.angle = lerpAngle(ship.angle, Math.atan2(dx, -dy), clamp(ROTATE_SPEED * dt, 0, 1));
      }
      ship.thrust = 0.3;
      descendT += dt;
      // shrink as we land (just slow render-time bump in scale handled in drawShip via state)
      if (descendT > 1.6) finishDelivery();
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

    // stars twinkle, pickups bob
    for (const s of stars) s.tw += dt * s.tws;
    for (const p of pickups) p.bob += dt * 2.4;

    // debris
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.92; d.vy *= 0.92;
      if (d.age >= d.life) debris.splice(i, 1);
    }
    // sparkles
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const d = sparkles[i];
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.88; d.vy *= 0.88;
      if (d.age >= d.life) sparkles.splice(i, 1);
    }

    updateHUD();
    updateRadarDist();
  }

  function updateHUD() {
    hudX.textContent = String(Math.round(ship.x)).padStart(3, '0');
    hudY.textContent = String(Math.round(ship.y)).padStart(3, '0');
    const sp = Math.hypot(ship.vx, ship.vy);
    hudSpd.textContent = sp.toFixed(1).padStart(5, '0');
    let deg = (ship.angle * 180 / Math.PI + 360) % 360;
    hudHdg.textContent = String(Math.round(deg)).padStart(3, '0') + '°';

    const f = pickFrame();
    segs.forEach((seg, i) => {
      seg.classList.toggle('on', i < f.level);
      seg.classList.toggle('fast', f.level === 3);
    });
  }

  function updateRadarDist() {
    const tp = planets.find(p => p.target);
    if (!tp) return;
    const d = Math.hypot(tp.x - ship.x, tp.y - ship.y);
    // map px → light years (decorative)
    const ly = Math.max(0.0, (d / 1000)).toFixed(1);
    radarDist.textContent = ly + ' ly';
  }

  function pickFrame() {
    if (!ship.alive) return { label: 'damage', level: 0, img: null };
    if (ship.thrust < 0.08) return { label: 'standard', level: 0, img: imgs.standard };
    if (ship.thrust < 0.4)  return { label: 'fly-1',    level: 1, img: imgs.fly1 };
    if (ship.thrust < 0.75) return { label: 'fly-2',    level: 2, img: imgs.fly2 };
    return { label: 'fly-3', level: 3, img: imgs.fly3 };
  }

  // ---------- render ----------
  function render() {
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1A1B2E');
    grad.addColorStop(0.55, '#22223D');
    grad.addColorStop(1, '#2C2A45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // warm horizon wash
    ctx.fillStyle = 'rgba(217, 119, 87, 0.04)';
    ctx.fillRect(0, H * 0.65, W, H * 0.35);

    // stars
    for (const s of stars) {
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.tw));
      ctx.fillStyle = s.c;
      ctx.globalAlpha = a * s.pdepth * 1.4;
      ctx.fillRect(s.x | 0, s.y | 0, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // planets (real images)
    for (const p of planets) {
      const im = planetImgs[p.img];
      if (!im || !im.complete) continue;
      // target dock ring (pulsing)
      if (p.target) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
        ctx.save();
        ctx.strokeStyle = `rgba(143, 161, 122, ${0.25 + 0.25 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.dock + 6 + 3 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // inner glow
        const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r + 30);
        g.addColorStop(0, 'rgba(143, 161, 122, 0.0)');
        g.addColorStop(1, 'rgba(143, 161, 122, 0.18)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const size = p.r * 2;
      ctx.drawImage(im, p.x - p.r, p.y - p.r, size, size);
      // label
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(247, 240, 220, 0.7)';
      ctx.fillText(p.name, p.x, p.y + p.r + 14);
      if (p.target) {
        ctx.fillStyle = 'rgba(143, 161, 122, 0.95)';
        ctx.font = 'bold 8px "Silkscreen", monospace';
        ctx.fillText('▼ TARGET', p.x, p.y - p.r - 6);
      }
    }

    // ingredient pickups
    for (const p of pickups) {
      if (p.collected) continue;
      const ing = INGREDIENTS[p.type];
      const yo = Math.sin(p.bob) * 2;
      ctx.save();
      ctx.translate(p.x, p.y + yo);
      // soft halo
      const haloR = 14 + Math.sin(p.bob * 2) * 1.5;
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
      hg.addColorStop(0, ing.color + 'aa');
      hg.addColorStop(1, ing.color + '00');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.fillStyle = ing.color;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ing.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(-1.5, -1.8, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // asteroids
    for (const a of asteroids) drawAsteroid(a);

    // ship or explosion
    if (ship.alive) {
      const f = pickFrame();
      const s = phase === 'delivering' ? clamp(1 - descendT / 1.8, 0.3, 1) : 1;
      drawShip(f.img, ship.x, ship.y, ship.angle, s);
    } else {
      const elapsed = (performance.now() - ship.explodeStart) / 1000;
      const idx = Math.min(4, Math.floor(elapsed / 0.16));
      const im = [imgs.dmg1, imgs.dmg2, imgs.dmg3, imgs.dmg4, imgs.dmg5][idx];
      drawShip(im, ship.x, ship.y, 0, 1.2);
    }

    // debris
    for (const d of debris) {
      const t = 1 - d.age / d.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size * t, d.size * t);
    }
    // sparkles
    for (const d of sparkles) {
      const t = 1 - d.age / d.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size);
    }
    ctx.globalAlpha = 1;

    // vignette
    const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.4, W/2, H/2, Math.max(W,H)*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShip(img, x, y, angle, scale = 1) {
    if (!img) return;
    const baseScale = 0.55 * scale;
    const w = img.width * baseScale;
    const h = img.height * baseScale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    const N = 9;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const r = a.r * (0.78 + 0.22 * Math.sin(a.seed + i * 1.7) * Math.cos(a.seed * 0.3 + i));
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    ctx.fillStyle = '#5B5A6E';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) { const [px, py] = pts[i]; ctx.lineTo(px + 3, py + 3); }
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#7F7E92';
    ctx.beginPath(); ctx.arc(-a.r * 0.3, -a.r * 0.3, a.r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1D1F33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // ---------- radar render ----------
  function renderRadar() {
    const RW = radar.width, RH = radar.height;
    rctx.clearRect(0, 0, RW, RH);
    // background grid
    rctx.fillStyle = '#0E0F1C';
    rctx.beginPath(); rctx.arc(RW/2, RH/2, RW/2, 0, Math.PI * 2); rctx.fill();
    // crosshair
    rctx.strokeStyle = 'rgba(247,240,220,0.08)';
    rctx.lineWidth = 1;
    rctx.beginPath();
    rctx.moveTo(0, RH/2); rctx.lineTo(RW, RH/2);
    rctx.moveTo(RW/2, 0); rctx.lineTo(RW/2, RH);
    rctx.stroke();
    // sweep
    const sweep = (performance.now() / 1800) % 1;
    const sa = sweep * Math.PI * 2;
    rctx.save();
    rctx.translate(RW/2, RH/2);
    const grad = rctx.createConicGradient ? rctx.createConicGradient(sa - 0.5, 0, 0) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(143,161,122,0.0)');
      grad.addColorStop(0.05, 'rgba(143,161,122,0.35)');
      grad.addColorStop(0.15, 'rgba(143,161,122,0.0)');
      rctx.fillStyle = grad;
      rctx.beginPath(); rctx.arc(0, 0, RW/2, 0, Math.PI * 2); rctx.fill();
    }
    rctx.restore();

    // map function: world (0..W) → radar
    const mapX = (x) => (x / W) * RW;
    const mapY = (y) => (y / H) * RH;

    // asteroids — small flat dots
    rctx.fillStyle = 'rgba(247,240,220,0.25)';
    for (const a of asteroids) {
      rctx.fillRect(mapX(a.x) - 2, mapY(a.y) - 2, 4, 4);
    }
    // ingredients
    for (const p of pickups) {
      if (p.collected) continue;
      rctx.fillStyle = INGREDIENTS[p.type].color;
      rctx.beginPath(); rctx.arc(mapX(p.x), mapY(p.y), 3, 0, Math.PI * 2); rctx.fill();
    }
    // planets
    for (const p of planets) {
      const rad = Math.max(4, p.r / 8);
      rctx.fillStyle = p.target ? '#E08A4B' : p.accent;
      rctx.beginPath(); rctx.arc(mapX(p.x), mapY(p.y), rad, 0, Math.PI * 2); rctx.fill();
      if (p.target) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
        rctx.strokeStyle = `rgba(224, 138, 75, ${0.4 + 0.5 * pulse})`;
        rctx.lineWidth = 2;
        rctx.beginPath(); rctx.arc(mapX(p.x), mapY(p.y), rad + 4 + 3 * pulse, 0, Math.PI * 2); rctx.stroke();
      }
    }
    // ship — terracotta arrow
    rctx.save();
    rctx.translate(mapX(ship.x), mapY(ship.y));
    rctx.rotate(ship.angle);
    rctx.fillStyle = '#D97757';
    rctx.beginPath();
    rctx.moveTo(0, -8);
    rctx.lineTo(6, 6);
    rctx.lineTo(0, 3);
    rctx.lineTo(-6, 6);
    rctx.closePath();
    rctx.fill();
    rctx.strokeStyle = '#1D1F33';
    rctx.lineWidth = 1.5;
    rctx.stroke();
    rctx.restore();
  }

  // ---------- delivery sequence ----------
  function triggerDelivery() {
    phase = 'delivering';
    descendT = 0;
    nearTarget = false;
    prompt.classList.remove('show');
    veil.classList.add('show');
    updateState('delivering');
    setComm({
      name: 'gloop',
      handle: 'slime · mossport',
      mood: 'descent',
      moodColor: 'var(--ember)',
      line: "oh — that's you, isn't it? coming in slow… i'll put the kettle on.",
      primary: { label: 'landing…' },
      portraitClass: 'gloop',
    });
    actPrimary.disabled = true;
  }

  function finishDelivery() {
    phase = 'thanks';
    veil.classList.remove('show');
    ship.vx = 0; ship.vy = 0; ship.thrust = 0;
    updateState('idle');
    setComm({
      name: 'gloop',
      handle: 'slime · mossport',
      mood: 'calm',
      moodColor: 'var(--sage-deep)',
      line: "i hadn't eaten all day… thanks, little gyoza. i think i'll nap. you'll come back, right?",
      primary: { label: 'wave goodbye' },
      portraitClass: 'gloop',
    });
    // make portrait mood look calm
    const dot = document.querySelector('.order-card .portrait .mood');
    if (dot) dot.classList.add('calm');
    actPrimary.disabled = false;
    actPrimary.onclick = nextQuest;
  }

  function nextQuest() {
    // simple loop: cycle the target to next planet
    const cur = planets.findIndex(p => p.target);
    planets[cur].target = false;
    const next = (cur + 1) % planets.length;
    planets[next].target = true;
    const np = planets[next];
    setComm({
      name: np.npc,
      handle: speciesFor(np.npc) + ' · ' + np.name,
      mood: moodFor(np.npc),
      moodColor: 'var(--ember)',
      line: dishLineFor(np.npc),
      primary: { label: 'begin descent' },
      portraitClass: portraitClassFor(np.npc),
    });
    // update quest mini-card
    document.getElementById('quest-title').textContent = np.npc + ' · ' + np.name;
    document.getElementById('quest-dish').textContent = dishFor(np.npc);
    document.getElementById('quest-avatar').textContent = np.npc[0].toUpperCase();
    // reset progress
    document.querySelector('.progress-fill').style.width = '33%';
    document.querySelector('.progress-text').textContent = '1/3';
    actPrimary.onclick = onPrimary;
    phase = 'flight';
    resetShip();
  }

  function speciesFor(npc) {
    return { 'gloop': 'slime', 'nani': 'moon-rabbit', 'porra-7': 'merchant', 'mr.quench': 'astronaut' }[npc] || 'guest';
  }
  function moodFor(npc) {
    return { 'gloop': 'sleepy', 'nani': 'patient', 'porra-7': 'hungry', 'mr.quench': 'thirsty' }[npc] || 'hopeful';
  }
  function dishFor(npc) {
    return {
      'gloop': 'emotionally supportive takoyaki',
      'nani': 'tiny comfort dumplings',
      'porra-7': 'triple black hole ramen',
      'mr.quench': 'a single, very cold donut',
    }[npc] || 'something warm';
  }
  function dishLineFor(npc) {
    return {
      'gloop': 'hey little gyoza… i\'m having one of those days. when you can, no rush.',
      'nani': 'the stars are bright tonight. could you bring something soft to eat?',
      'porra-7': 'you. ramen. me. money. let\'s do this thing.',
      'mr.quench': 'i can\'t remember if i ate today. or yesterday. just… something cold.',
    }[npc] || 'thanks for stopping by.';
  }
  function portraitClassFor(npc) {
    return { 'gloop': 'gloop', 'nani': 'nani', 'porra-7': 'porra', 'mr.quench': 'quench' }[npc] || 'gloop';
  }

  function onPrimary() {
    if (phase === 'flight' && nearTarget) triggerDelivery();
  }
  actPrimary.onclick = onPrimary;

  // delivery log button — placeholder gentle nudge
  document.getElementById('act-log').onclick = () => {
    setComm({
      name: 'log',
      handle: 'sector ribbon · day 03',
      mood: '11 delivered',
      moodColor: 'var(--sage-deep)',
      line: 'gloop · mossport — 9 times. always sleepy. nani · lunar-9 — 1 time. tea was warm. porra-7 — 1 time. paid in beans.',
      primary: { label: 'back to flight' },
      portraitClass: 'gloop',
    });
    actPrimary.onclick = () => { actPrimary.onclick = onPrimary; resetCommToCurrent(); };
  };

  function resetCommToCurrent() {
    const tp = planets.find(p => p.target);
    if (!tp) return;
    setComm({
      name: tp.npc,
      handle: speciesFor(tp.npc) + ' · ' + tp.name,
      mood: moodFor(tp.npc),
      moodColor: 'var(--ember)',
      line: dishLineFor(tp.npc),
      primary: { label: 'begin descent' },
      portraitClass: portraitClassFor(tp.npc),
    });
  }

  // ---------- kitchen modal ----------
  const kitchenVeil = document.getElementById('kitchen-veil');
  document.getElementById('open-kitchen').onclick = () => kitchenVeil.classList.add('open');
  document.getElementById('close-kitchen').onclick = () => kitchenVeil.classList.remove('open');
  kitchenVeil.addEventListener('click', (e) => { if (e.target === kitchenVeil) kitchenVeil.classList.remove('open'); });
  // toggle equip on card click
  document.querySelectorAll('.topping-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.empty !== undefined) return;
      const equipped = document.querySelectorAll('.topping-card[data-equipped]').length;
      if (card.hasAttribute('data-equipped')) {
        card.removeAttribute('data-equipped');
      } else if (equipped < 4) {
        card.setAttribute('data-equipped', '');
      }
    });
  });

  function start() {
    canvas.focus();
    requestAnimationFrame(frameLoop);
  }
})();
