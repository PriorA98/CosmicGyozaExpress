// gyoza-components.jsx — UI component artboards
const { BoardHeader, StarField, Tag, ShipGlyph, PixelIcon, Eyebrow, Planet, GyozaSprite, Surface } = window;

// =============================================================================
// 05 · Buttons & inputs
// =============================================================================
function GCButtonsBoard() {
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="components"
        title="Buttons, keycaps, sliders"
        subtitle="terracotta primary, ink pill secondary, retro pixel button for the cockpit. all copy lowercase."
      />
      <div style={{ padding: '0 28px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* primary / secondary buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Eyebrow>primary action · "begin descent"</Eyebrow>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <BtnPrimary>invite to room</BtnPrimary>
              <BtnPrimary keycap="E">begin descent</BtnPrimary>
              <BtnPrimary state="hover">hover</BtnPrimary>
              <BtnPrimary state="disabled">disabled</BtnPrimary>
            </div>
          </div>
          <div>
            <Eyebrow>secondary · paper button</Eyebrow>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <BtnSecondary keycap="L">delivery log</BtnSecondary>
              <BtnSecondary keycap="M">galaxy map</BtnSecondary>
              <BtnSecondary>wave goodbye</BtnSecondary>
            </div>
          </div>
          <div>
            <Eyebrow>ink pill · top-bar / icon</Eyebrow>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <BtnInk><PixelIcon glyph="cog" size={14} color="var(--plaster)" /> settings</BtnInk>
              <BtnInk><PixelIcon glyph="pause" size={14} color="var(--plaster)" /> pause</BtnInk>
              <BtnInk><PixelIcon glyph="home" size={14} color="var(--plaster)" /> home</BtnInk>
            </div>
          </div>
        </div>

        {/* pixel + keycaps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Eyebrow>pixel · cockpit retro</Eyebrow>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <BtnPixel>thrust</BtnPixel>
              <BtnPixel variant="ember">stabilize</BtnPixel>
              <BtnPixel variant="cream">land</BtnPixel>
            </div>
          </div>
          <div>
            <Eyebrow>keycap legend</Eyebrow>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {['W','A','S','D','SPACE','E','L','ESC'].map(k => <Keycap key={k}>{k}</Keycap>)}
            </div>
          </div>
          <div>
            <Eyebrow>thrust slider + segmented bar</Eyebrow>
            <div style={{ background: 'var(--ink)', borderRadius: 'var(--r-sm)',
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
                color: 'rgba(251,247,236,0.55)', textTransform: 'uppercase' }}>
                <span>thrust output</span><span style={{ color: 'var(--ember-soft)' }}>0.72</span>
              </div>
              <SegBar value={0.72} />
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
                color: 'rgba(251,247,236,0.55)', textTransform: 'uppercase', marginTop: 2 }}>
                <span>fuel</span><span style={{ color: 'var(--sage-soft)' }}>0.84</span>
              </div>
              <SegBar value={0.84} color="var(--sage)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function BtnPrimary({ children, keycap, state = '' }) {
  const dim = state === 'disabled';
  const hover = state === 'hover';
  return (
    <button style={{
      background: hover ? 'var(--terracotta-deep)' : 'var(--terracotta)',
      color: '#FBF7EC',
      border: '1px solid var(--terracotta-deep)',
      borderRadius: 'var(--r-sm)',
      padding: '8px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 12,
      fontWeight: 600, letterSpacing: '0.04em',
      boxShadow: hover ? '0 1px 0 var(--terracotta-deep)' : '0 2px 0 var(--terracotta-deep)',
      transform: hover ? 'translateY(1px)' : 'none',
      opacity: dim ? 0.5 : 1,
      display: 'inline-flex', alignItems: 'center', gap: 8,
      cursor: 'pointer',
    }}>
      <span>{children}</span>
      {keycap && <span style={{
        background: 'rgba(0,0,0,0.18)', color: '#FBF7EC',
        fontSize: 10, padding: '1px 5px', borderRadius: 3,
      }}>{keycap}</span>}
    </button>
  );
}
function BtnSecondary({ children, keycap }) {
  return (
    <button style={{
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--r-sm)',
      padding: '8px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 12,
      letterSpacing: '0.04em',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      cursor: 'pointer',
    }}>
      <span>{children}</span>
      {keycap && <span style={{
        background: 'rgba(0,0,0,0.10)', color: 'var(--ink)',
        fontSize: 10, padding: '1px 5px', borderRadius: 3,
      }}>{keycap}</span>}
    </button>
  );
}
function BtnInk({ children }) {
  return (
    <button style={{
      background: 'var(--ink)', color: 'var(--plaster)',
      border: '1px solid var(--ink)', borderRadius: 'var(--r-sm)',
      padding: '6px 12px',
      fontFamily: 'var(--font-mono)', fontSize: 11.5,
      letterSpacing: '0.04em',
      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    }}>{children}</button>
  );
}
function BtnPixel({ children, variant = 'terracotta' }) {
  const v = {
    terracotta: { bg: 'var(--terracotta)', fg: '#FBF7EC' },
    ember:      { bg: 'var(--ember)',      fg: 'var(--ink)' },
    cream:      { bg: 'var(--plaster)',    fg: 'var(--ink)' },
  }[variant];
  return (
    <button style={{
      background: v.bg, color: v.fg,
      border: '2px solid var(--ink)',
      borderRadius: 0,
      padding: '8px 14px',
      fontFamily: 'var(--font-pixel)', fontSize: 11,
      letterSpacing: 'var(--ls-pixel)',
      textTransform: 'uppercase',
      boxShadow: '3px 3px 0 var(--ink)',
      cursor: 'pointer',
    }}>{children}</button>
  );
}
function Keycap({ children }) {
  const wide = children.length > 1;
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: wide ? 48 : 28, height: 28,
      padding: wide ? '0 8px' : 0,
      background: 'var(--plaster)', color: 'var(--ink)',
      border: '1px solid var(--ink)', borderBottomWidth: 2,
      borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5,
      fontWeight: 700,
    }}>{children}</kbd>
  );
}
function SegBar({ value = 0.5, color = 'var(--terracotta)' }) {
  const segs = 16;
  const on = Math.round(value * segs);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 12 }}>
      {Array.from({ length: segs }).map((_, i) => (
        <span key={i} style={{
          flex: 1, height: 6, borderRadius: 1,
          background: i < on ? color : 'rgba(251,247,236,0.15)',
          boxShadow: i < on ? `0 0 6px ${color}` : 'none',
        }} />
      ))}
    </div>
  );
}

// =============================================================================
// 06 · State pills
// =============================================================================
function GCPillsBoard() {
  const states = [
    { s: 'idle',     label: 'idle',      desc: 'engine warm, no nav' },
    { s: 'flying',   label: 'flying',    desc: 'in transit · thrust on' },
    { s: 'docking',  label: 'docking',   desc: 'descent vector locked' },
    { s: 'delivering', label: 'delivering', desc: 'in conversation' },
    { s: 'exploded', label: 'gyoza incident', desc: 'soft pop · respawning' },
    { s: 'sleeping', label: 'zzz',       desc: 'home station, lights low' },
  ];
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="components"
        title="State pills"
        subtitle="how the ship and the world tell you what's happening — never harsh, always lowercase."
      />
      <div style={{ padding: '0 28px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {states.map(({ s, label, desc }) => <PillCell key={s} state={s} label={label} desc={desc} />)}
      </div>
    </div>
  );
}
function PillCell({ state, label, desc }) {
  const map = {
    idle:        { bg: 'var(--state-idle-bg)',     fg: 'var(--state-idle-fg)',     dot: 'var(--state-idle-dot)' },
    flying:      { bg: 'var(--state-running-bg)',  fg: 'var(--state-running-fg)',  dot: 'var(--state-running-dot)' },
    docking:     { bg: 'var(--state-waiting-bg)',  fg: 'var(--state-waiting-fg)',  dot: 'var(--state-waiting-dot)' },
    delivering:  { bg: 'var(--state-thinking-bg)', fg: 'var(--state-thinking-fg)', dot: 'var(--state-thinking-dot)' },
    exploded:    { bg: 'var(--state-error-bg)',    fg: 'var(--state-error-fg)',    dot: 'var(--state-error-dot)' },
    sleeping:    { bg: 'var(--state-sleeping-bg)', fg: 'var(--state-sleeping-fg)', dot: 'var(--state-sleeping-dot)' },
  }[state];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: map.bg, color: map.fg,
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em',
        padding: '4px 10px', borderRadius: 999, alignSelf: 'flex-start',
        textTransform: 'uppercase', border: '1px solid rgba(0,0,0,0.06)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: map.dot,
          boxShadow: `0 0 6px ${map.dot}` }} />
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
        {desc}
      </span>
    </div>
  );
}

// =============================================================================
// 07 · NPC portraits
// =============================================================================
function GCNpcBoard() {
  const npcs = [
    { name: 'gyoza · 01', sub: 'pilot · home',          ch: '⌬', bg: 'var(--terracotta-soft)', mood: 'doing its best', moodColor: 'var(--ember)' },
    { name: 'moon rabbit', sub: 'tea moon',             ch: 'ᴗ', bg: 'var(--plum-soft)',       mood: 'overworked',      moodColor: 'var(--plum)' },
    { name: 'space cat',   sub: 'orbit, bubble helmet', ch: '◕', bg: 'var(--dusk-blue-soft)',  mood: 'dramatic',        moodColor: 'var(--brick)' },
    { name: 'planet "i\'m fine"', sub: 'stormy class-c', ch: '☁', bg: 'var(--sage-soft)',      mood: 'crying geologically', moodColor: 'var(--teal)' },
    { name: 'black hole baker', sub: 'event-horizon bakery', ch: '◐', bg: 'var(--slate-300)', moodColor: 'var(--brick)', mood: 'calm (lying)' },
    { name: 'sleepy satellite', sub: 'low orbit',       ch: '◔', bg: 'var(--amber-soft)',     mood: 'low battery',     moodColor: 'var(--amber)' },
    { name: 'anxiety asteroid', sub: 'belt 7',          ch: '◊', bg: 'var(--brick-soft)',     mood: 'still moving',    moodColor: 'var(--brick)' },
    { name: 'rescue crab',     sub: 'tiny tow service', ch: 'Ѡ', bg: 'var(--terracotta-soft)',mood: 'on standby',      moodColor: 'var(--sage)' },
  ];
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="components"
        title="NPC portraits"
        subtitle="48px and 76px portraits, ink monogram center, tiny mood badge — color coded per state."
      />
      <div style={{ padding: '0 28px 28px',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {npcs.map((n, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <NpcPortrait size={64} bg={n.bg} ch={n.ch} mood={n.moodColor} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13.5,
                color: 'var(--ink)', lineHeight: 1.15 }}>{n.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)',
                marginTop: 2 }}>{n.sub}</div>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.05em',
              padding: '2px 8px', background: 'var(--parchment-deep)',
              borderRadius: 999, color: 'var(--ink-soft)', border: '1px solid var(--border)',
              textTransform: 'uppercase',
            }}>{n.mood}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function NpcPortrait({ size = 64, bg, ch, mood }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--r-sm)',
      background: bg, border: '1px solid rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size * 0.55,
      color: 'var(--ink)', position: 'relative',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {ch}
      <span style={{
        position: 'absolute', bottom: -4, right: -4,
        width: 14, height: 14, borderRadius: '50%',
        background: mood, border: '2px solid var(--surface)',
      }} />
    </div>
  );
}

// =============================================================================
// 08 · Dashboard widgets
// =============================================================================
function GCDashboardBoard() {
  return (
    <div className="ab cosmos-deep">
      <BoardHeader
        kicker="components"
        title="Cockpit widgets"
        subtitle="speedometer, fuel, package condition, drift, and the rotating useless-but-charming readouts. all live in the ink panel."
        style={{ color: 'var(--plaster)' }}
      />
      <div style={{ padding: '0 28px 28px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <SpeedDial value={124} max={300} />
        <FuelGauge value={0.62} />
        <PackageCondition state="warm but confused" pct={0.72} />
        <DriftMeter value={0.21} />
        <UselessReadouts />
        <DashChatter />
      </div>
    </div>
  );
}
function WidgetFrame({ title, hint, children, style }) {
  return (
    <div style={{
      background: 'rgba(20,22,38,0.78)',
      border: '1px solid rgba(247,240,220,0.18)',
      borderRadius: 'var(--r-md)',
      padding: 14, color: 'var(--plaster)',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160,
      ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
          textTransform: 'uppercase', color: 'rgba(251,247,236,0.55)' }}>{title}</span>
        {hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--ember-soft)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function SpeedDial({ value, max }) {
  const angle = -120 + (value / max) * 240; // -120° to +120°
  const cx = 60, cy = 56, r = 44;
  const ticks = Array.from({ length: 13 }).map((_, i) => {
    const t = -120 + i * 20;
    const a = (t * Math.PI) / 180;
    return {
      x1: cx + Math.cos(a) * (r - 2), y1: cy + Math.sin(a) * (r - 2),
      x2: cx + Math.cos(a) * (r - 8), y2: cy + Math.sin(a) * (r - 8),
      hi: i >= 9,
    };
  });
  const needleA = (angle * Math.PI) / 180;
  return (
    <WidgetFrame title="velocity" hint={`${value} px/s`}>
      <svg viewBox="0 0 120 100" style={{ width: '100%', height: 'auto' }}>
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.hi ? 'var(--terracotta)' : 'rgba(247,240,220,0.4)'}
            strokeWidth={t.hi ? 2 : 1} />
        ))}
        <circle cx={cx} cy={cy} r={r-12} fill="none" stroke="rgba(247,240,220,0.1)" strokeWidth={1} />
        <line x1={cx} y1={cy} x2={cx + Math.cos(needleA) * (r - 14)}
          y2={cy + Math.sin(needleA) * (r - 14)} stroke="var(--ember)" strokeWidth={2.5}
          strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill="var(--ember)" />
        <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--plaster)"
          fontFamily="var(--font-pixel)" fontSize="10" letterSpacing="0.12em">
          PX/S
        </text>
      </svg>
    </WidgetFrame>
  );
}
function FuelGauge({ value }) {
  const segs = 12;
  const on = Math.round(value * segs);
  return (
    <WidgetFrame title="sauce tank" hint={`${Math.round(value*100)}%`}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
        <PixelIcon glyph="fuel" size={36} color="var(--ember-soft)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: segs }).map((_, i) => {
            const idx = segs - 1 - i;
            const lit = idx < on;
            const color = idx < 3 ? 'var(--brick)' : 'var(--ember)';
            return (
              <span key={i} style={{
                width: 64, height: 6, borderRadius: 1,
                background: lit ? color : 'rgba(247,240,220,0.12)',
                boxShadow: lit ? `0 0 6px ${color}` : 'none',
              }} />
            );
          })}
        </div>
      </div>
    </WidgetFrame>
  );
}
function PackageCondition({ state, pct }) {
  return (
    <WidgetFrame title="package · #247-b">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PixelIcon glyph="package" size={36} color="var(--sage)" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 15, color: 'var(--plaster)', lineHeight: 1.1 }}>
            warm but confused
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'rgba(251,247,236,0.6)', marginTop: 4 }}>
            still delicious · still on time
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(251,247,236,0.5)',
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
          condition meter
        </div>
        <div style={{ height: 6, background: 'rgba(247,240,220,0.12)', borderRadius: 3 }}>
          <div style={{ width: `${pct*100}%`, height: '100%', background: 'var(--sage)',
            borderRadius: 3, boxShadow: '0 0 8px var(--sage)' }} />
        </div>
      </div>
    </WidgetFrame>
  );
}
function DriftMeter({ value }) {
  const angle = value * 60; // -60..+60 mapping (here just 0..60)
  return (
    <WidgetFrame title="drift angle" hint={`${(value * 60).toFixed(1)}°`}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative' }}>
        <div style={{
          width: 120, height: 50, borderTop: '1px dashed rgba(247,240,220,0.2)',
          borderLeft: '1px solid rgba(247,240,220,0.15)',
          borderRight: '1px solid rgba(247,240,220,0.15)',
          position: 'relative', borderRadius: '0 0 60px 60px',
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: -2,
            width: 2, height: 50, background: 'var(--ember)',
            transformOrigin: '50% 100%', transform: `translateX(-50%) rotate(${angle}deg)`,
            boxShadow: '0 0 6px var(--ember)',
          }} />
          <div style={{ position: 'absolute', left: '50%', top: -2, width: 6, height: 6,
            background: 'var(--ember)', borderRadius: '50%', transform: 'translateX(-50%) translateY(-50%)' }} />
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'rgba(251,247,236,0.6)', textAlign: 'center' }}>
        within acceptable wobble
      </div>
    </WidgetFrame>
  );
}
function UselessReadouts() {
  const rows = [
    { k: 'gyoza crispiness',    v: 'optimal' },
    { k: 'snack morale',        v: 'rising' },
    { k: 'cosmic cuteness',     v: '98%' },
    { k: 'brain goblin noise',  v: 'low' },
    { k: 'tiny dramatic level', v: 'high' },
  ];
  return (
    <WidgetFrame title="flavor readouts" hint="rotating">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11, alignItems: 'baseline' }}>
            <span style={{ color: 'rgba(251,247,236,0.6)' }}>{r.k}</span>
            <span style={{ color: 'var(--plaster)' }}>{r.v}</span>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}
function DashChatter() {
  return (
    <WidgetFrame title="dashboard · ch-7" hint="speaking">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-display)',
        fontStyle: 'italic', fontSize: 14, color: 'var(--plaster)', lineHeight: 1.4 }}>
        <span>"speed is high. confidence is also high. this may be related."</span>
        <span style={{ color: 'rgba(251,247,236,0.55)', fontSize: 12 }}>
          "reminder: exploding is not a moral failure."
        </span>
      </div>
    </WidgetFrame>
  );
}

// =============================================================================
// 09 · Map nodes
// =============================================================================
function GCMapNodesBoard() {
  return (
    <div className="ab cosmos">
      <StarField count={50} seed={4} />
      <BoardHeader
        kicker="components"
        title="Galaxy map nodes"
        subtitle="planet + status frame. lit = open · faint = locked · pulse = active · cup = complete."
        style={{ color: 'var(--plaster)' }}
      />
      <div style={{ padding: '0 28px 28px',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        <MapNode planet={0} label="tea moon" sub="lv 1 · open" status="open" />
        <MapNode planet={3} label="bento belt" sub="lv 2 · active" status="active" />
        <MapNode planet={7} label="matcha nebula" sub="lv 3 · open" status="open" />
        <MapNode planet={1} label="black hole bakery" sub="lv 4 · locked" status="locked" />
        <MapNode planet={4} label='planet "i\u2019m fine"' sub="lv 5 · complete" status="complete" />
        <MapNode planet={5} label="sleepy satellite" sub="side quest" status="side" />
        <MapNode planet={6} label="asteroid lounge" sub="hidden" status="hidden" />
        <MapNode planet={2} label="home station" sub="hub" status="hub" />
      </div>
    </div>
  );
}
function MapNode({ planet, label, sub, status }) {
  const styles = {
    open:     { ring: 'var(--ember)',       opacity: 1,   badge: 'open' },
    active:   { ring: 'var(--terracotta)',  opacity: 1,   badge: 'in transit', pulse: true },
    locked:   { ring: 'rgba(247,240,220,0.2)', opacity: 0.45, badge: 'locked' },
    complete: { ring: 'var(--sage)',        opacity: 1,   badge: '✓ delivered' },
    side:     { ring: 'var(--plum)',        opacity: 1,   badge: 'side' },
    hidden:   { ring: 'rgba(247,240,220,0.15)', opacity: 0.35, badge: '???' },
    hub:      { ring: 'var(--dusk-blue)',   opacity: 1,   badge: 'hub' },
  }[status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      opacity: styles.opacity }}>
      <div style={{
        position: 'relative', width: 96, height: 96,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px ${status === 'locked' || status === 'hidden' ? 'dashed' : 'solid'} ${styles.ring}`,
          boxShadow: styles.pulse ? `0 0 14px ${styles.ring}, inset 0 0 8px ${styles.ring}` : `0 0 8px ${styles.ring}`,
        }} />
        <Planet index={planet} size={72} />
        {styles.pulse && (
          <span style={{
            position: 'absolute', top: -8, right: -8,
            background: 'var(--terracotta)', color: '#FBF7EC',
            fontFamily: 'var(--font-pixel)', fontSize: 9,
            letterSpacing: 'var(--ls-pixel)', padding: '2px 6px',
            borderRadius: 0, border: '2px solid var(--ink)',
            boxShadow: 'var(--shadow-pixel-sm)',
          }}>NOW</span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
        color: 'var(--plaster)' }}>{label}</div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
        color: styles.ring, padding: '2px 8px',
        background: 'rgba(20,22,38,0.6)', border: `1px solid ${styles.ring}`,
        borderRadius: 999, textTransform: 'uppercase',
      }}>{styles.badge}</span>
    </div>
  );
}

// =============================================================================
// 10 · Cards (request, mission, memory)
// =============================================================================
function GCCardsBoard() {
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="components"
        title="Cards · request, mission, memory"
        subtitle="three card species: incoming delivery request, mission list row, and the soft cosmetic memories you collect."
      />
      <div style={{ padding: '0 28px 28px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'flex-start' }}>
        <RequestCard />
        <MissionCard />
        <MemoryCard />
      </div>
    </div>
  );
}
function RequestCard() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
          textTransform: 'uppercase', color: 'var(--ember)' }}>incoming request</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-dim)' }}>#247-b · 0.4 ly</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 10, marginBottom: 10 }}>
        <NpcPortrait size={48} bg="var(--teal-soft)" ch="G" mood="var(--ember)" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, lineHeight: 1.1 }}>
            gloop
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>
            slime · mossport
          </div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13,
        color: 'var(--ink-soft)', lineHeight: 1.45, marginBottom: 12 }}>
        "hey little gyoza… i'm having one of those days. when you can, no rush. i'll leave the porch light on."
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
          emotionally supportive takoyaki
        </span>
        <button style={{
          background: 'var(--terracotta)', color: '#FBF7EC',
          border: '1px solid var(--terracotta-deep)', borderRadius: 'var(--r-sm)',
          padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.04em', cursor: 'pointer',
          boxShadow: '0 2px 0 var(--terracotta-deep)',
        }}>accept</button>
      </div>
    </div>
  );
}
function MissionCard() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
          textTransform: 'uppercase', color: 'var(--ink-mute)' }}>route · lv 5</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brick)',
          background: 'var(--brick-soft)', padding: '2px 8px', borderRadius: 999,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>storm zone</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12, alignItems: 'center' }}>
        <Planet index={4} size={60} glow="rgba(143,170,196,0.4)" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
            letterSpacing: 'var(--ls-tight)', lineHeight: 1.1 }}>
            planet "i'm fine"
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
            soup + warm blanket module
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span><span style={{ color: 'var(--ink-mute)' }}>dist</span> <b>2.1 ly</b></span>
          <span><span style={{ color: 'var(--ink-mute)' }}>reward</span> <b>120ø</b></span>
        </div>
        <PixelIcon glyph="chev" size={14} color="var(--ink-mute)" />
      </div>
    </div>
  );
}
function MemoryCard() {
  return (
    <div style={{
      background: 'var(--parchment-warm)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: 14,
      transform: 'rotate(-1.5deg)', boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)',
          textTransform: 'uppercase', color: 'var(--terracotta)' }}>★ memory · 014</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>day 03</span>
      </div>
      <div style={{
        background: 'var(--plaster)', border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--r-sm)', padding: 12, marginBottom: 10,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14,
          color: 'var(--ink)', lineHeight: 1.5 }}>
          "i was going to reorganize the craters again, but maybe i will sit down for twelve seconds."
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <NpcPortrait size={40} bg="var(--plum-soft)" ch="ᴗ" mood="var(--sage)" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>
            moon rabbit · tea moon
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
            from a successful tea delivery
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 11 · Comm / dialog
// =============================================================================
function GCDialogBoard() {
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="components"
        title="Comm panel & dashboard chatter"
        subtitle="two voices: the npc (display italic, warm) and the dashboard (mono italic, cool)."
      />
      <div style={{ padding: '0 28px 28px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* npc comm */}
        <div style={{
          background: 'var(--parchment-warm)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: 14, display: 'grid',
          gridTemplateColumns: '64px 1fr', gap: 12,
        }}>
          <NpcPortrait size={64} bg="var(--teal-soft)" ch="G" mood="var(--ember)" />
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>gloop</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-dim)' }}>
                slime · mossport
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-pixel)', fontSize: 9, letterSpacing: 'var(--ls-pixel)',
              color: 'var(--sage-deep)', marginTop: 2 }}>
              <span style={{ width: 6, height: 6, background: 'var(--sage)', borderRadius: '50%' }} />
              OPEN FREQ · CH-7
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-soft)',
              lineHeight: 1.4, marginTop: 8, marginBottom: 0, maxWidth: 380 }}>
              hey little gyoza… i'm having one of those days. when you can, no rush. i'll leave the porch light on.
            </p>
          </div>
        </div>

        {/* dashboard chatter */}
        <div style={{
          background: 'var(--ink)', color: 'var(--plaster)', border: '1px solid var(--ink)',
          borderRadius: 'var(--r-md)', padding: 14, display: 'flex',
          flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)' }}>
            <span style={{ color: 'var(--ember-soft)' }}>DASHBOARD · CH-7</span>
            <span style={{ color: 'rgba(251,247,236,0.55)' }}>14:08 · LT</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--ember-soft)' }}>›</span> approaching destination. please look professional.
            </li>
            <li style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5,
              color: 'rgba(251,247,236,0.75)' }}>
              <span style={{ color: 'var(--ember-soft)' }}>›</span> docking angle: emotionally complicated.
            </li>
            <li style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5,
              color: 'rgba(251,247,236,0.55)' }}>
              <span style={{ color: 'var(--ember-soft)' }}>›</span> trajectory says maybe. heart says yes.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  GCButtonsBoard, GCPillsBoard, GCNpcBoard, GCDashboardBoard, GCMapNodesBoard,
  GCCardsBoard, GCDialogBoard, NpcPortrait, BtnPrimary, BtnSecondary, BtnInk, BtnPixel, Keycap, PillCell,
});
