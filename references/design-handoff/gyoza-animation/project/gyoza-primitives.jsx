// Tiny shared primitives used across the gyoza UI boards.
// Exposed to window so other Babel scripts can use them.

// -----------------------------------------------------------------------------
// Pixel star field — drops 60 tiny stars in a deterministic-ish layout.
function StarField({ count = 60, seed = 1 }) {
  // simple LCG so the pattern is stable per render
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const stars = [];
  for (let i = 0; i < count; i++) {
    const top = (rand() * 100).toFixed(1) + '%';
    const left = (rand() * 100).toFixed(1) + '%';
    const big = rand() > 0.85;
    const tint = rand() > 0.7;
    const o = (0.3 + rand() * 0.6).toFixed(2);
    stars.push(
      <span
        key={i}
        className={`${big ? 'big ' : ''}${tint ? 'tint' : ''}`}
        style={{ top, left, '--o': o }}
      />
    );
  }
  return <div className="stars">{stars}</div>;
}

// -----------------------------------------------------------------------------
// Tag — small monospace label used everywhere on artboards.
function Tag({ children, color = 'ink', style }) {
  const map = {
    ink:        { bg: 'transparent',          fg: 'var(--ink-mute)',  border: '1px dashed var(--border)' },
    ghost:      { bg: 'rgba(255,255,255,.08)', fg: 'rgba(251,247,236,.7)', border: '1px dashed rgba(251,247,236,.2)' },
    accent:     { bg: 'var(--terracotta)',    fg: '#FBF7EC',          border: '1px solid var(--terracotta-deep)' },
  };
  const c = map[color] || map.ink;
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'var(--font-mono)', fontSize: 10,
      letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 3,
      background: c.bg, color: c.fg, border: c.border,
      ...style,
    }}>{children}</span>
  );
}

// -----------------------------------------------------------------------------
// Eyebrow / spec label, sits above a sub-cluster on an artboard
function Eyebrow({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 9.5,
      letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase',
      color: 'var(--ink-mute)', marginBottom: 8,
      ...style,
    }}>{children}</div>
  );
}

// -----------------------------------------------------------------------------
// Pixel-styled gyoza-ship logo mark drawn at SVG so we can scale it cleanly.
// Body: warm tan; trim: dusk-blue dome; outline: ink.
function ShipGlyph({ size = 64 }) {
  // 16×16 pixel layout, rendered with crisp edges.
  const c = {
    ink: '#1D1F33',
    body: '#D9B782',
    bodyDk: '#A8835A',
    dome: '#9EB6C4',
    domeLt: '#C9D9E3',
    leg: '#8A6A45',
    flame: '#E08A4B',
  };
  // pixel matrix
  const g = c.body, d = c.bodyDk, k = c.ink, dome = c.dome, hi = c.domeLt, leg = c.leg, f = c.flame, _ = null;
  const grid = [
    [_,_,_,_,k,k,k,k,k,k,_,_,_,_,_,_],
    [_,_,_,k,dome,dome,hi,hi,dome,dome,k,_,_,_,_,_],
    [_,_,k,dome,dome,hi,hi,hi,hi,dome,dome,k,_,_,_,_],
    [_,_,k,dome,hi,hi,hi,hi,hi,hi,dome,k,_,_,_,_],
    [_,_,_,k,dome,dome,dome,dome,dome,dome,k,_,_,_,_,_],
    [_,k,k,k,k,k,k,k,k,k,k,k,k,_,_,_],
    [k,g,g,g,g,g,g,g,g,g,g,g,g,k,_,_],
    [k,g,d,g,g,d,g,g,d,g,g,d,g,k,_,_],
    [k,g,g,d,g,g,d,g,g,d,g,g,d,k,_,_],
    [_,k,d,g,d,g,g,d,g,g,d,g,k,_,_,_],
    [_,_,k,k,leg,k,k,k,k,leg,k,k,_,_,_,_],
    [_,_,_,k,leg,k,_,_,_,k,leg,k,_,_,_,_],
    [_,_,_,_,k,_,_,f,_,_,k,_,_,_,_,_],
    [_,_,_,_,_,_,f,f,f,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,f,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ];
  const px = size / 16;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: 'pixelated' }} aria-hidden="true">
      {grid.map((row, y) =>
        row.map((color, x) =>
          color ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null
        )
      )}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Pixel-glyph icon — simple ink silhouettes for the dashboard icon set.
function PixelIcon({ glyph = 'thrust', size = 24, color = 'var(--ink)' }) {
  const G = {
    thrust:  ['..##..', '.####.', '.####.', '######', '##..##', '#....#'],
    fuel:    ['.####.', '##..##', '##..##', '##..##', '######', '######'],
    package: ['######', '##.##.', '#.##.#', '#.##.#', '##.##.', '######'],
    radar:   ['.####.', '##..##', '#.##.#', '#.##.#', '##..##', '.####.'],
    speed:   ['.....#', '....##', '..####', '######', '######', '######'],
    drift:   ['##....', '.##...', '..##..', '...##.', '....##', '....##'],
    crash:   ['#.#.#.', '.#.#.#', '##.##.', '.##.##', '#.#.#.', '.#.#.#'],
    star:    ['..#...', '.###..', '######', '.###..', '.#.#..', '.#.#..'],
    soup:    ['######', '##..##', '#....#', '#....#', '##..##', '.####.'],
    chili:   ['..#...', '..##..', '..###.', '..##..', '..#...', '..#...'],
    moon:    ['..###.', '.##.##', '##....', '##....', '.##.##', '..###.'],
    crab:    ['#.#.#.', '######', '######', '##..##', '#....#', '#....#'],
    cake:    ['.####.', '######', '#.#.#.', '######', '######', '######'],
    blanket: ['######', '#.#.#.', '######', '#.#.#.', '######', '#.#.#.'],
    note:    ['######', '#....#', '#.##.#', '#....#', '#.##.#', '######'],
    cocoa:   ['.####.', '######', '##..##', '#....#', '##..##', '.####.'],
    pause:   ['.##.##', '.##.##', '.##.##', '.##.##', '.##.##', '.##.##'],
    play:    ['##....', '####..', '######', '######', '####..', '##....'],
    chev:    ['#.....', '##....', '.##...', '.##...', '##....', '#.....'],
    cog:     ['..##..', '.####.', '######', '##..##', '######', '.####.'],
    locked:  ['.####.', '##..##', '######', '######', '##..##', '######'],
    home:    ['..##..', '.####.', '######', '######', '#....#', '######'],
    tea:     ['######', '#....#', '#....#', '######', '.####.', '..##..'],
    bell:    ['..##..', '.####.', '######', '######', '######', '..##..'],
    wave:    ['.#..#.', '##.##.', '######', '######', '##.##.', '.#..#.'],
  };
  const rows = G[glyph] || G.star;
  const w = rows[0].length;
  const h = rows.length;
  const u = size / Math.max(w, h);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {rows.map((row, y) =>
        [...row].map((ch, x) =>
          ch === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null
        )
      )}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Section label sitting at top of an artboard
function BoardHeader({ kicker, title, subtitle, style }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      padding: '20px 28px 0', marginBottom: 16, ...style,
    }}>
      <div>
        {kicker && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
            textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4,
          }}>{kicker}</div>
        )}
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22,
          letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', lineHeight: 1.1,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-mute)',
            marginTop: 4, maxWidth: 560,
          }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Planet — uses one of the planet PNGs from assets/planets/ with optional ring.
function Planet({ index = 0, size = 80, glow = 'rgba(155,143,184,0.35)', style }) {
  const file = `assets/planets/planet${String(index).padStart(2, '0')}.png`;
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      filter: `drop-shadow(0 0 ${size * 0.15}px ${glow})`,
      ...style,
    }}>
      <img src={file} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// GyozaSprite — wraps the existing PNG ship at proper scale
function GyozaSprite({ src = 'assets/default.png', size = 64, style }) {
  return (
    <img
      className="pix"
      src={src}
      alt="gyoza ship"
      style={{ width: size, height: size, ...style }}
    />
  );
}

// -----------------------------------------------------------------------------
// Surface — generic card frame in the parchment system
function Surface({ children, style, variant = 'surface' }) {
  const variants = {
    surface:  { bg: 'var(--surface)', border: '1px solid var(--border)' },
    raised:   { bg: 'var(--parchment-warm)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' },
    inkPanel: { bg: 'rgba(20,22,38,0.78)', border: '1px solid rgba(247,240,220,0.18)', color: 'var(--plaster)' },
    inkSolid: { bg: '#14162B', border: '1px solid rgba(247,240,220,0.16)', color: 'var(--plaster)' },
  };
  const v = variants[variant] || variants.surface;
  return (
    <div style={{
      background: v.bg, border: v.border, borderRadius: 'var(--r-md)',
      boxShadow: v.boxShadow, color: v.color || 'inherit',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  StarField, Tag, Eyebrow, ShipGlyph, PixelIcon, BoardHeader, Planet, GyozaSprite, Surface,
});
