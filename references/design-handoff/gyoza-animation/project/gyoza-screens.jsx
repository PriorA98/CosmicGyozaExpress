// gyoza-screens.jsx — Screen artboards (1280×720)
const {
  StarField, Tag, ShipGlyph, PixelIcon, Eyebrow, Planet, GyozaSprite,
  NpcPortrait, BtnPrimary, BtnSecondary, BtnInk, BtnPixel, Keycap,
} = window;

// =============================================================================
// 12 · Title screen
// =============================================================================
function GSTitle() {
  return (
    <div className="ab cosmos" style={{ height: '100%' }}>
      <StarField count={120} seed={7} />
      {/* big background planet */}
      <div style={{
        position: 'absolute', right: -120, bottom: -120, opacity: 0.85,
      }}>
        <Planet index={0} size={640} glow="rgba(143,182,196,0.45)" />
      </div>
      {/* small planet upper-left */}
      <div style={{ position: 'absolute', top: 60, left: 60, opacity: 0.65 }}>
        <Planet index={5} size={120} glow="rgba(232,154,75,0.35)" />
      </div>

      {/* center stack */}
      <div style={{
        position: 'absolute', inset: 0, padding: 80,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        zIndex: 2,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11,
            letterSpacing: 'var(--ls-pixel)', color: 'rgba(251,247,236,0.55)' }}>
            ★ a tiny cozy game · for one specific person
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'rgba(251,247,236,0.5)' }}>v 0.3.0 · 2026</span>
        </div>

        {/* title */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 36 }}>
          <GyozaSprite size={180} />
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 120, lineHeight: 0.88,
              letterSpacing: '-0.03em', color: 'var(--plaster)',
            }}>
              gyoza<br/>
              <span style={{ color: 'var(--ember)' }}>galaxy</span><br/>
              delivery
            </div>
            <div style={{
              marginTop: 18, fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 22, color: 'rgba(251,247,236,0.75)', maxWidth: 560,
            }}>
              warm food, comfort items, and absurd emergency snacks — delivered, somehow, by a dumpling ship doing its best.
            </div>
          </div>
        </div>

        {/* CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button style={{
            background: 'var(--terracotta)', color: '#FBF7EC',
            border: '2px solid var(--ink)', borderRadius: 0,
            padding: '14px 26px', fontFamily: 'var(--font-pixel)', fontSize: 14,
            letterSpacing: 'var(--ls-pixel)', textTransform: 'uppercase',
            boxShadow: '4px 4px 0 var(--ink)', cursor: 'pointer',
          }}>start delivery ▶</button>
          <button style={{
            background: 'rgba(20,22,38,0.65)', color: 'var(--plaster)',
            border: '1px solid rgba(251,247,236,0.35)', borderRadius: 'var(--r-sm)',
            padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: 12,
            letterSpacing: '0.04em', cursor: 'pointer', backdropFilter: 'blur(2px)',
          }}>continue · day 03 ›</button>
          <button style={{
            background: 'transparent', color: 'rgba(251,247,236,0.7)',
            border: '1px dashed rgba(251,247,236,0.25)', borderRadius: 'var(--r-sm)',
            padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: 12,
            letterSpacing: '0.04em', cursor: 'pointer',
          }}>free drift mode</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <BtnInk><PixelIcon glyph="cog" size={12} color="var(--plaster)" /> settings</BtnInk>
            <BtnInk>credits</BtnInk>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 13 · Mode select
// =============================================================================
function GSModeSelect() {
  const modes = [
    {
      name: 'cozy mode', tag: 'recommended',
      desc: "softer collisions, more fuel, wider docking zones, no timers. the dashboard is gentler and a small rescue crab will always come for you.",
      bg: 'var(--sage-soft)', accent: 'var(--sage-deep)',
      stats: [['collisions','soft'],['fuel','generous'],['timer','none']],
      planet: 0,
    },
    {
      name: 'spicy mode', tag: 'replay',
      desc: "tighter docking, stronger gravity, faster asteroids. still funny when you explode. just slightly more often.",
      bg: 'var(--terracotta-soft)', accent: 'var(--terracotta-deep)',
      stats: [['collisions','firm'],['fuel','tight'],['timer','optional']],
      planet: 7,
    },
    {
      name: 'free drift', tag: 'no missions',
      desc: "no quests. fly around, visit your favorites, collect stars, find the hidden jokes. the dashboard will narrate the silence.",
      bg: 'var(--plum-soft)', accent: 'var(--plum)',
      stats: [['missions','none'],['music','always'],['rescue','always']],
      planet: 3,
    },
  ];
  return (
    <div className="ab cosmos" style={{ height: '100%' }}>
      <StarField count={70} seed={9} />
      <div style={{ padding: '48px 64px 32px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, letterSpacing: 'var(--ls-pixel)',
              color: 'var(--ember-soft)', marginBottom: 6 }}>
              ★ flight mode
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 44,
              color: 'var(--plaster)', letterSpacing: 'var(--ls-tight)', lineHeight: 1 }}>
              how would you like<br/>to fly today?
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(251,247,236,0.55)',
            maxWidth: 320, textAlign: 'right' }}>
            you can change this anytime from the pause menu. there is no wrong answer.
          </div>
        </div>

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {modes.map((m, i) => (
            <div key={i} style={{
              background: 'var(--parchment-warm)', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
              boxShadow: i === 0 ? '0 0 0 2px var(--ember), 0 10px 28px rgba(0,0,0,0.4)' : 'var(--shadow-md)',
              position: 'relative',
            }}>
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: -10, left: 18,
                  background: 'var(--ember)', color: 'var(--ink)',
                  fontFamily: 'var(--font-pixel)', fontSize: 9,
                  letterSpacing: 'var(--ls-pixel)', padding: '3px 8px',
                  border: '2px solid var(--ink)',
                }}>★ DEFAULT</span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Planet index={m.planet} size={56} glow={`${m.accent}55`} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
                  textTransform: 'uppercase', color: m.accent,
                  padding: '2px 8px', background: m.bg, borderRadius: 999,
                }}>{m.tag}</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24,
                  letterSpacing: 'var(--ls-tight)', lineHeight: 1.05 }}>{m.name}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-mute)',
                  marginTop: 6, lineHeight: 1.5 }}>{m.desc}</div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
                paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                {m.stats.map(([k, v], j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>{k}</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <button style={{
                background: i === 0 ? 'var(--terracotta)' : 'transparent',
                color: i === 0 ? '#FBF7EC' : 'var(--ink)',
                border: i === 0 ? '1px solid var(--terracotta-deep)' : '1px solid var(--border-strong)',
                borderRadius: 'var(--r-sm)', padding: '8px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: i === 0 ? '0 2px 0 var(--terracotta-deep)' : 'none',
              }}>{i === 0 ? 'launch in cozy' : 'try this'}</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'rgba(251,247,236,0.55)' }}>
          <Keycap>←</Keycap> <Keycap>→</Keycap> &nbsp; navigate &nbsp;·&nbsp;
          <Keycap>↵</Keycap> select &nbsp;·&nbsp;
          <Keycap>ESC</Keycap> back to title
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 14 · Galaxy map
// =============================================================================
function GSGalaxyMap() {
  // hand-laid map. Each node has %x %y. Routes are svg paths between ids.
  const nodes = [
    { id: 'home',    x: 12,  y: 78, label: 'home station',         status: 'hub',      planet: 2, sub: 'kitchen · dock' },
    { id: 'tea',     x: 28,  y: 58, label: 'tea moon',             status: 'complete', planet: 0, sub: 'lv 1' },
    { id: 'bento',   x: 44,  y: 70, label: 'asteroid bento belt',  status: 'complete', planet: 6, sub: 'lv 2' },
    { id: 'matcha',  x: 56,  y: 42, label: 'matcha nebula',        status: 'open',     planet: 7, sub: 'lv 3' },
    { id: 'moss',    x: 72,  y: 60, label: 'mossport',             status: 'active',   planet: 3, sub: 'gloop · now' },
    { id: 'bakery',  x: 84,  y: 32, label: 'black hole bakery',    status: 'locked',   planet: 1, sub: 'lv 4 — locked' },
    { id: 'fine',    x: 38,  y: 24, label: 'planet "i\u2019m fine"', status: 'open',   planet: 4, sub: 'lv 5' },
    { id: 'satellite', x: 20, y: 36, label: 'sleepy satellite',    status: 'side',     planet: 5, sub: 'side · cocoa' },
    { id: 'asteroid', x: 88, y: 75, label: 'anxiety asteroid',     status: 'side',     planet: 8, sub: 'side · blanket' },
  ];
  const links = [
    ['home','tea'],['tea','bento'],['bento','matcha'],['matcha','moss'],
    ['matcha','bakery'],['tea','fine'],['fine','satellite'],['home','satellite'],
    ['bento','asteroid'],['moss','bakery'],
  ];
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={130} seed={11} />
      {/* top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(251,247,236,0.12)',
        background: 'rgba(20,22,38,0.6)', zIndex: 3, backdropFilter: 'blur(2px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GyozaSprite size={28} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--plaster)' }}>
              the porra ribbon
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(251,247,236,0.55)',
              letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              galaxy map · sector ii of v
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'rgba(251,247,236,0.7)' }}>
          <span><span style={{ color: 'rgba(251,247,236,0.45)' }}>day</span> <b style={{ color: 'var(--plaster)' }}>03</b></span>
          <span><span style={{ color: 'rgba(251,247,236,0.45)' }}>delivered</span> <b style={{ color: 'var(--sage-soft)' }}>11/24</b></span>
          <span><span style={{ color: 'rgba(251,247,236,0.45)' }}>coins</span> <b style={{ color: 'var(--ember-soft)' }}>248ø</b></span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <BtnInk><PixelIcon glyph="bell" size={12} color="var(--plaster)" /> inbox · 2</BtnInk>
          <BtnInk><PixelIcon glyph="pause" size={12} color="var(--plaster)" /> pause</BtnInk>
        </div>
      </div>

      {/* map canvas */}
      <div style={{ position: 'absolute', inset: '64px 320px 56px 24px' }}>
        {/* svg routes layer */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <pattern id="dotline" patternUnits="userSpaceOnUse" width="6" height="6">
              <circle cx="3" cy="3" r="1.2" fill="rgba(251,247,236,0.35)" />
            </pattern>
          </defs>
          {links.map(([a, b], i) => {
            const A = byId[a], B = byId[b];
            const isActive = (a === 'moss' || b === 'moss');
            return (
              <line key={i}
                x1={`${A.x}%`} y1={`${A.y}%`} x2={`${B.x}%`} y2={`${B.y}%`}
                stroke={isActive ? 'var(--ember)' : 'url(#dotline)'}
                strokeWidth={isActive ? 1.5 : 6} strokeOpacity={isActive ? 0.85 : 1}
                strokeDasharray={isActive ? '5 4' : 'none'} />
            );
          })}
        </svg>
        {nodes.map(n => <MapPin key={n.id} node={n} />)}
      </div>

      {/* mission panel right */}
      <aside style={{
        position: 'absolute', top: 64, right: 0, bottom: 0, width: 296,
        background: 'rgba(20,22,38,0.85)', borderLeft: '1px solid rgba(251,247,236,0.14)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 14, zIndex: 2,
      }}>
        <div>
          <Eyebrow style={{ color: 'rgba(251,247,236,0.55)', marginBottom: 6 }}>active delivery</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Planet index={3} size={52} glow="rgba(232,154,75,0.5)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17,
                color: 'var(--plaster)', lineHeight: 1.1 }}>mossport</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
                color: 'rgba(251,247,236,0.65)', marginTop: 3 }}>
                gloop · 0.4 ly · #247-b
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 13, color: 'rgba(251,247,236,0.85)', lineHeight: 1.45 }}>
            "no rush. i'll leave the porch light on."
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PixelIcon glyph="soup" size={16} color="var(--ember-soft)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ember-soft)' }}>
              emotionally supportive takoyaki
            </span>
          </div>
        </div>

        <button style={{
          background: 'var(--terracotta)', color: '#FBF7EC',
          border: '2px solid var(--ink)', borderRadius: 0,
          padding: '12px 14px', fontFamily: 'var(--font-pixel)', fontSize: 12,
          letterSpacing: 'var(--ls-pixel)', textTransform: 'uppercase',
          boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer',
        }}>launch ▶ &nbsp;<span style={{ opacity: 0.7 }}>↵</span></button>

        <div style={{ borderTop: '1px dashed rgba(251,247,236,0.2)', paddingTop: 12 }}>
          <Eyebrow style={{ color: 'rgba(251,247,236,0.55)', marginBottom: 8 }}>inbox · 2 unread</Eyebrow>
          <InboxRow ch="◔" bg="var(--amber-soft)" name="sleepy satellite" sub="cocoa capsule · 0.9 ly" unread />
          <InboxRow ch="◊" bg="var(--brick-soft)" name="anxiety asteroid" sub="blanket module · 1.4 ly" unread />
          <InboxRow ch="ᴗ" bg="var(--plum-soft)" name="moon rabbit" sub="thank-you note" />
        </div>

        <div style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'rgba(251,247,236,0.4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span><Keycap>M</Keycap> &nbsp;close map</span>
          <span>click node · view request</span>
          <span><Keycap>L</Keycap> &nbsp;delivery log</span>
        </div>
      </aside>

      {/* bottom legend */}
      <div style={{
        position: 'absolute', left: 24, bottom: 12, right: 320,
        display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'rgba(251,247,236,0.6)', alignItems: 'center', zIndex: 3,
      }}>
        <LegendDot color="var(--ember)" label="open" />
        <LegendDot color="var(--terracotta)" label="active route" />
        <LegendDot color="var(--sage)" label="delivered" />
        <LegendDot color="var(--plum)" label="side quest" />
        <LegendDot color="rgba(251,247,236,0.3)" label="locked" dashed />
      </div>
    </div>
  );
}
function MapPin({ node }) {
  const styles = {
    open:     { ring: 'var(--ember)' },
    active:   { ring: 'var(--terracotta)', pulse: true },
    locked:   { ring: 'rgba(251,247,236,0.25)', dim: true, dashed: true },
    complete: { ring: 'var(--sage)' },
    side:     { ring: 'var(--plum)' },
    hub:      { ring: 'var(--dusk-blue)' },
  }[node.status];
  return (
    <div style={{
      position: 'absolute', left: `${node.x}%`, top: `${node.y}%`,
      transform: 'translate(-50%, -50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      opacity: styles.dim ? 0.55 : 1,
    }}>
      <div style={{ position: 'relative', width: 64, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px ${styles.dashed ? 'dashed' : 'solid'} ${styles.ring}`,
          boxShadow: styles.pulse ? `0 0 16px ${styles.ring}` : `0 0 6px ${styles.ring}55`,
        }} />
        <Planet index={node.planet} size={46} glow={`${styles.ring}55`} />
        {styles.pulse && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: 'var(--terracotta)', color: '#FBF7EC',
            fontFamily: 'var(--font-pixel)', fontSize: 9, padding: '2px 6px',
            border: '2px solid var(--ink)', letterSpacing: 'var(--ls-pixel)',
          }}>NOW</span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12,
        color: 'var(--plaster)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{node.label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: styles.ring }}>
        {node.sub}
      </div>
    </div>
  );
}
function InboxRow({ ch, bg, name, sub, unread }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10,
      alignItems: 'center', padding: '7px 0', borderBottom: '1px dashed rgba(251,247,236,0.1)' }}>
      <NpcPortrait size={32} bg={bg} ch={ch} mood={unread ? 'var(--ember)' : 'var(--sage)'} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--plaster)',
          fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(251,247,236,0.55)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      {unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ember)' }} />}
    </div>
  );
}
function LegendDot({ color, label, dashed }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      }} />
      {label}
    </span>
  );
}

// =============================================================================
// 15 · Mission briefing modal (sits over the map)
// =============================================================================
function GSBriefing() {
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={50} seed={2} />
      {/* faint map underneath */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
        <Planet index={4} size={420} style={{ position: 'absolute', top: 80, right: -80 }} />
        <Planet index={5} size={180} style={{ position: 'absolute', bottom: 80, left: 100 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,22,38,0.55)',
        backdropFilter: 'blur(4px)' }} />

      {/* modal */}
      <div style={{
        position: 'absolute', top: 60, left: 80, right: 80, bottom: 60,
        background: 'var(--parchment-warm)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
        display: 'grid', gridTemplateColumns: '380px 1fr', gap: 0,
        overflow: 'hidden',
      }}>
        {/* left rail — recipient */}
        <div style={{ background: 'var(--parchment-deep)', padding: 28,
          display: 'flex', flexDirection: 'column', gap: 18,
          borderRight: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10,
              letterSpacing: 'var(--ls-pixel)', color: 'var(--terracotta)' }}>
              ★ delivery request · #248-a
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 30,
              letterSpacing: 'var(--ls-tight)', marginTop: 6, lineHeight: 1 }}>
              planet "i'm fine"
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
              stormy class-c · 2.1 ly from home
            </div>
          </div>
          <Planet index={4} size={180} glow="rgba(143,170,196,0.45)" style={{ alignSelf: 'center' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '8px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span><span style={{ color: 'var(--ink-mute)' }}>reward</span> <b>120ø</b></span>
            <span><span style={{ color: 'var(--ink-mute)' }}>memory</span> <b>+1</b></span>
            <span><span style={{ color: 'var(--ink-mute)' }}>charm</span> <b>+2</b></span>
          </div>
        </div>

        {/* right — message + route + actions */}
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {/* message */}
          <div>
            <Eyebrow>incoming transmission</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 14, marginTop: 6 }}>
              <NpcPortrait size={60} bg="var(--sage-soft)" ch="☁" mood="var(--teal)" />
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17 }}>
                    the tiny planet that says "i'm fine"
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-dim)',
                  marginTop: 3 }}>mood: crying geologically</div>
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic',
                  fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 10,
                  marginBottom: 0 }}>
                  "this is not a request. but if soup appeared nearby, i would not file a complaint."
                </p>
              </div>
            </div>
          </div>

          {/* delivery item */}
          <div style={{
            background: 'var(--plaster)', border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--r-sm)', padding: 14,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          }}>
            <div>
              <Eyebrow>delivering</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <PixelIcon glyph="soup" size={24} color="var(--ember)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
                    letterSpacing: 'var(--ls-tight)' }}>soup + warm blanket</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                    package · cozy / warm
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Eyebrow>route hazards</Eyebrow>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <Tag>soft storm currents</Tag>
                <Tag>moving asteroids</Tag>
                <Tag>gentle landing zone</Tag>
              </div>
            </div>
          </div>

          {/* dashboard preview */}
          <div style={{
            background: 'var(--ink)', color: 'var(--plaster)',
            borderRadius: 'var(--r-sm)', padding: '12px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55,
          }}>
            <div style={{ color: 'var(--ember-soft)' }}>› DASHBOARD PRE-FLIGHT</div>
            <div>route plotted. confidence: <span style={{ color: 'var(--sage-soft)' }}>brave</span>.</div>
            <div>recipient appears <span style={{ color: 'var(--sage-soft)' }}>snack-compatible</span>.</div>
            <div>reminder: <span style={{ color: 'var(--ember-soft)' }}>exploding is not a moral failure</span>.</div>
          </div>

          {/* actions */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={{
              background: 'var(--terracotta)', color: '#FBF7EC',
              border: '2px solid var(--ink)', borderRadius: 0,
              padding: '12px 22px', fontFamily: 'var(--font-pixel)', fontSize: 12,
              letterSpacing: 'var(--ls-pixel)', textTransform: 'uppercase',
              boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer',
            }}>accept &amp; launch &nbsp;↵</button>
            <BtnSecondary keycap="P">prep kitchen</BtnSecondary>
            <BtnSecondary keycap="ESC">back to map</BtnSecondary>
            <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--ink-mute)' }}>
              you can decline. nobody minds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 17 · Cockpit dashboard close-up (read-only view)
// =============================================================================
function GSCockpit() {
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={70} seed={5} />
      <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)',
              color: 'var(--ember-soft)' }}>★ cockpit · ch-7</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 28,
              color: 'var(--plaster)', letterSpacing: 'var(--ls-tight)', marginTop: 2, lineHeight: 1 }}>
              instruments
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,236,0.55)',
              marginTop: 2 }}>
              in transit to mossport · 0.4 ly · ETA 00:38
            </div>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em',
            background: 'var(--state-running-bg)', color: 'var(--state-running-fg)',
            padding: '4px 12px', borderRadius: 999, textTransform: 'uppercase',
          }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: 'var(--state-running-dot)', boxShadow: '0 0 6px var(--state-running-dot)',
              marginRight: 7 }} />
            flying
          </span>
        </div>

        {/* big grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
          {/* left big speed + ship */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CockpitTile title="velocity vector" hint="124.3 px/s" flex>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: '100%' }}>
                <BigDial value={124} max={300} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                  <Readout k="heading" v="287°" />
                  <Readout k="drift" v="0.04" />
                  <Readout k="thrust" v="0.72" big />
                  <Readout k="grav. influence" v="low" />
                </div>
              </div>
            </CockpitTile>
            <CockpitTile title="ship · gyoza-01" hint="hull intact" flex>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
                <GyozaSprite size={64} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SegRow label="hull" value={0.92} color="var(--sage)" />
                  <SegRow label="sauce" value={0.62} color="var(--ember)" />
                  <SegRow label="package warmth" value={0.84} color="var(--terracotta)" />
                </div>
              </div>
            </CockpitTile>
          </div>

          {/* mid stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CockpitTile title="package · #247-b" hint="warm but confused" flex>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PixelIcon glyph="package" size={36} color="var(--sage)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
                    color: 'var(--plaster)', lineHeight: 1.1 }}>emotionally supportive takoyaki</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
                    color: 'rgba(251,247,236,0.55)', marginTop: 4 }}>still delicious · still on time</div>
                </div>
              </div>
            </CockpitTile>
            <CockpitTile title="proximity radar" hint="0.4 ly" flex>
              <RadarDial />
            </CockpitTile>
            <CockpitTile title="flavor readouts" hint="rotating">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <FlavorRow k="snack morale" v="rising" />
                <FlavorRow k="cosmic cuteness" v="98%" />
                <FlavorRow k="dumpling wobble" v="acceptable" />
                <FlavorRow k="pilot confidence" v="doing its best" />
              </div>
            </CockpitTile>
          </div>

          {/* right — chatter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CockpitTile title="dashboard · ch-7" hint="speaking" flex>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Chatter line="approaching destination. please look professional." active />
                <Chatter line="package temperature stable. emotional temperature improving." />
                <Chatter line="docking angle: emotionally complicated." />
                <Chatter line="reminder: exploding is not a moral failure." />
                <Chatter line="trajectory says maybe. heart says yes." />
              </div>
            </CockpitTile>
            <CockpitTile title="audio · ost" hint="0.6 vol" >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PixelIcon glyph="play" size={20} color="var(--ember-soft)" />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
                    color: 'var(--plaster)' }}>noodle bay</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'rgba(251,247,236,0.55)' }}>lofi · 03:14 / 04:02</div>
                </div>
              </div>
            </CockpitTile>
          </div>
        </div>
      </div>
    </div>
  );
}
function CockpitTile({ title, hint, children, flex }) {
  return (
    <div style={{
      background: 'rgba(20,22,38,0.78)', border: '1px solid rgba(247,240,220,0.18)',
      borderRadius: 'var(--r-md)', padding: 14, color: 'var(--plaster)',
      display: 'flex', flexDirection: 'column', gap: 10,
      flex: flex ? 1 : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
          textTransform: 'uppercase', color: 'rgba(251,247,236,0.55)' }}>{title}</span>
        {hint && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ember-soft)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function BigDial({ value, max }) {
  const angle = -135 + (value / max) * 270;
  const cx = 60, cy = 62, r = 50;
  const needleA = (angle * Math.PI) / 180;
  const ticks = Array.from({ length: 19 }).map((_, i) => {
    const t = -135 + i * 15;
    const a = (t * Math.PI) / 180;
    const hi = i % 3 === 0;
    return {
      x1: cx + Math.cos(a) * (r - 2), y1: cy + Math.sin(a) * (r - 2),
      x2: cx + Math.cos(a) * (r - (hi ? 10 : 6)), y2: cy + Math.sin(a) * (r - (hi ? 10 : 6)),
      red: i >= 15,
    };
  });
  return (
    <svg viewBox="0 0 120 130" style={{ width: '100%', height: '100%' }}>
      <circle cx={cx} cy={cy} r={r-1} fill="rgba(0,0,0,0.25)" stroke="rgba(247,240,220,0.15)" />
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.red ? 'var(--brick)' : 'rgba(247,240,220,0.4)'}
          strokeWidth={1.5} />
      ))}
      <line x1={cx} y1={cy} x2={cx + Math.cos(needleA) * (r - 14)}
        y2={cy + Math.sin(needleA) * (r - 14)} stroke="var(--ember)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="var(--ember)" />
      <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--plaster)"
        fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">{value}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill="rgba(247,240,220,0.5)"
        fontFamily="var(--font-pixel)" fontSize="8" letterSpacing="0.12em">PX/S</text>
    </svg>
  );
}
function Readout({ k, v, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      borderBottom: '1px dashed rgba(247,240,220,0.12)', paddingBottom: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'rgba(251,247,236,0.55)' }}>{k}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: big ? 16 : 13,
        fontWeight: big ? 700 : 500,
        color: big ? 'var(--ember-soft)' : 'var(--plaster)' }}>{v}</span>
    </div>
  );
}
function SegRow({ label, value, color }) {
  const segs = 14;
  const on = Math.round(value * segs);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'rgba(251,247,236,0.55)', marginBottom: 3 }}>
        <span>{label}</span><span>{Math.round(value*100)}%</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} style={{
            flex: 1, height: 5, borderRadius: 1,
            background: i < on ? color : 'rgba(251,247,236,0.12)',
            boxShadow: i < on ? `0 0 4px ${color}` : 'none',
          }} />
        ))}
      </div>
    </div>
  );
}
function RadarDial() {
  return (
    <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="radar-bg">
          <stop offset="0" stopColor="#10122a" />
          <stop offset="1" stopColor="#0a0b18" />
        </radialGradient>
        <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--sage)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--sage)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <circle cx={60} cy={60} r={50} fill="url(#radar-bg)" stroke="rgba(247,240,220,0.15)" />
      <circle cx={60} cy={60} r={36} fill="none" stroke="rgba(247,240,220,0.12)" strokeDasharray="2 4" />
      <circle cx={60} cy={60} r={22} fill="none" stroke="rgba(247,240,220,0.12)" strokeDasharray="2 4" />
      <line x1={60} y1={60} x2={102} y2={60} stroke="url(#sweep)" strokeWidth={3} />
      {/* targets */}
      <circle cx={86} cy={42} r={3} fill="var(--terracotta)" />
      <circle cx={36} cy={78} r={2} fill="var(--plum)" />
      <circle cx={70} cy={88} r={2} fill="var(--dusk-blue)" />
      <text x={86} y={36} fontFamily="var(--font-pixel)" fontSize="8"
        textAnchor="middle" fill="var(--terracotta)" letterSpacing="0.12em">MOSS</text>
    </svg>
  );
}
function FlavorRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)', fontSize: 11, alignItems: 'baseline' }}>
      <span style={{ color: 'rgba(251,247,236,0.55)' }}>{k}</span>
      <span style={{ color: 'var(--plaster)' }}>{v}</span>
    </div>
  );
}
function Chatter({ line, active }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.45,
      color: active ? 'var(--plaster)' : 'rgba(251,247,236,0.55)',
    }}>
      <span style={{ color: 'var(--ember-soft)', marginRight: 6 }}>›</span>{line}
    </div>
  );
}

// =============================================================================
// 18 · Crash / respawn
// =============================================================================
function GSCrash() {
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={50} seed={6} />
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 55%, rgba(194,105,84,0.20), rgba(20,22,38,0.0) 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, padding: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 28 }}>
        {/* crumbs sprite */}
        <div style={{ position: 'relative', width: 260, height: 200 }}>
          {/* crumb scatter */}
          {[
            { x: 30, y: 110, r: -20, s: 64 },
            { x: 110, y: 80, r: 8, s: 80 },
            { x: 160, y: 130, r: 30, s: 56 },
          ].map((c, i) => (
            <img key={i} className="pix" src={`assets/dmg-${i+1}.png`}
              style={{
                position: 'absolute', left: c.x, top: c.y,
                width: c.s, height: c.s, transform: `rotate(${c.r}deg)`,
                opacity: 0.95,
              }} alt="" />
          ))}
          {/* steam puffs */}
          {[
            { x: 90, y: 30, o: 0.5, s: 40 },
            { x: 140, y: 50, o: 0.7, s: 28 },
            { x: 60, y: 60, o: 0.4, s: 24 },
          ].map((c, i) => (
            <div key={i} style={{
              position: 'absolute', left: c.x, top: c.y, width: c.s, height: c.s,
              borderRadius: '50%', background: 'rgba(251,247,236,0.4)',
              filter: 'blur(6px)', opacity: c.o,
            }} />
          ))}
        </div>

        <div style={{ textAlign: 'center', maxWidth: 720 }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11, letterSpacing: 'var(--ls-pixel)',
            color: 'var(--brick)' }}>★ GYOZA INCIDENT DETECTED</span>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 56,
            color: 'var(--plaster)', letterSpacing: 'var(--ls-tight)', lineHeight: 1, marginTop: 10 }}>
            briefly soup.
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 19,
            color: 'rgba(251,247,236,0.78)', marginTop: 14, lineHeight: 1.45 }}>
            "delivery confidence reduced by 3%. no worries. space is rude."
          </div>
        </div>

        {/* status panel */}
        <div style={{
          width: 720, background: 'rgba(20,22,38,0.78)',
          border: '1px solid rgba(247,240,220,0.18)', borderRadius: 'var(--r-md)',
          padding: 18, color: 'var(--plaster)',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
        }}>
          <CrashStat k="hull integrity" v="92%" hint="rewrapping" />
          <CrashStat k="package" v="sideways" hint="still delicious" />
          <CrashStat k="rescue crab" v="ETA 00:04" hint="incoming" emphasis />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={{
            background: 'var(--terracotta)', color: '#FBF7EC',
            border: '2px solid var(--ink)', borderRadius: 0,
            padding: '12px 22px', fontFamily: 'var(--font-pixel)', fontSize: 12,
            letterSpacing: 'var(--ls-pixel)', textTransform: 'uppercase',
            boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer',
          }}>rewrap &amp; retry ↵</button>
          <BtnSecondary keycap="M">return to map</BtnSecondary>
          <div style={{ marginLeft: 18, fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'rgba(251,247,236,0.55)' }}>
            attempt #2 · failure is part of the flavor
          </div>
        </div>
      </div>
    </div>
  );
}
function CrashStat({ k, v, hint, emphasis }) {
  return (
    <div style={{
      background: emphasis ? 'rgba(232,154,75,0.12)' : 'transparent',
      border: emphasis ? '1px dashed var(--ember)' : '1px dashed rgba(247,240,220,0.18)',
      borderRadius: 'var(--r-sm)', padding: '10px 12px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5,
        letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase',
        color: 'rgba(251,247,236,0.55)' }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22,
        color: emphasis ? 'var(--ember-soft)' : 'var(--plaster)', lineHeight: 1.1, marginTop: 4 }}>{v}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: 'rgba(251,247,236,0.55)', marginTop: 4 }}>{hint}</div>
    </div>
  );
}

// =============================================================================
// 19 · Delivery success
// =============================================================================
function GSSuccess() {
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={70} seed={8} />
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 45%, rgba(141,161,122,0.30), rgba(20,22,38,0.0) 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, padding: 48,
        display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, alignItems: 'center' }}>
        {/* left — npc reacting */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: 'var(--ls-pixel)',
            color: 'var(--sage-soft)' }}>★ DELIVERY COMPLETE · #247-B</span>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 64,
            color: 'var(--plaster)', letterSpacing: 'var(--ls-tight)', lineHeight: 0.95 }}>
            warmth<br/>increased<br/>locally.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(20,22,38,0.7)', border: '1px solid rgba(247,240,220,0.18)',
            borderRadius: 'var(--r-md)', padding: 14, color: 'var(--plaster)', maxWidth: 540 }}>
            <NpcPortrait size={64} bg="var(--teal-soft)" ch="G" mood="var(--sage)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
                color: 'var(--plaster)' }}>gloop</div>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16,
                color: 'rgba(251,247,236,0.85)', marginTop: 6, lineHeight: 1.4 }}>
                "it's a little sideways, but honestly so am i today. thank you, little ship."
              </div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,236,0.6)' }}>
            <span style={{ color: 'var(--ember-soft)' }}>›</span> &nbsp;
            "mission complete. someone feels 7% less alone."
          </div>
        </div>

        {/* right — rewards */}
        <div style={{
          background: 'var(--parchment-warm)', color: 'var(--ink)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div>
            <Eyebrow>delivery report</Eyebrow>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22,
              letterSpacing: 'var(--ls-tight)', marginTop: 2 }}>
              chaotic delivery · accepted warmly
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatBox k="coins" v="+45ø" tag="route" />
            <StatBox k="bonus" v="+12ø" tag="cozy" />
            <StatBox k="speed" v="best" tag="day" highlight />
          </div>
          <div style={{
            border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-sm)',
            padding: 12, background: 'var(--plaster)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Eyebrow style={{ margin: 0 }}>new memory unlocked</Eyebrow>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>015 / 60</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <PixelIcon glyph="note" size={28} color="var(--terracotta)" />
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14,
                color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                "a tiny note from gloop, smelling faintly of takoyaki."
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>condition rating</Eyebrow>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag>★ smooth delivery</Tag>
              <Tag>★ cozy success</Tag>
              <Tag style={{ background: 'var(--sage-soft)', color: 'var(--sage-deep)',
                border: '1px solid var(--sage)' }}>perfect timing</Tag>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            <button style={{
              flex: 1, background: 'var(--terracotta)', color: '#FBF7EC',
              border: '1px solid var(--terracotta-deep)', borderRadius: 'var(--r-sm)',
              padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12,
              letterSpacing: '0.04em', cursor: 'pointer',
              boxShadow: '0 2px 0 var(--terracotta-deep)',
            }}>next delivery ↵</button>
            <BtnSecondary keycap="M">galaxy map</BtnSecondary>
          </div>
        </div>
      </div>
    </div>
  );
}
function StatBox({ k, v, tag, highlight }) {
  return (
    <div style={{
      background: highlight ? 'var(--ember-soft)' : 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 'var(--ls-wide)',
        textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
        color: 'var(--ink)', lineHeight: 1.1, marginTop: 2 }}>{v}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-mute)',
        marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tag}</div>
    </div>
  );
}

// =============================================================================
// 20 · Memories collection (cozy collection screen)
// =============================================================================
function GSMemories() {
  const memories = [
    { id: 14, ch: 'ᴗ', bg: 'var(--plum-soft)', text: '"i was going to reorganize the craters again, but maybe i will sit down for twelve seconds."', from: 'moon rabbit · tea moon', day: 'day 01', rot: -2 },
    { id: 13, ch: '◕', bg: 'var(--dusk-blue-soft)', text: '"the universe is still unacceptable, but now i am full."', from: 'space cat', day: 'day 02', rot: 1.5 },
    { id: 12, ch: '◔', bg: 'var(--amber-soft)', text: '"signal restored. mood also slightly restored."', from: 'sleepy satellite', day: 'day 02', rot: -0.5 },
    { id: 11, ch: '◐', bg: 'var(--slate-300)', text: '"the void has eaten six cakes today. this one is for me."', from: 'black hole baker', day: 'day 03', rot: 2 },
    { id: 10, ch: '☁', bg: 'var(--sage-soft)', text: '"i did not need this. i am only crying geologically."', from: 'planet "i\u2019m fine"', day: 'day 03', rot: -1.2, locked: true },
    { id: 9,  ch: '◊', bg: 'var(--brick-soft)', text: '"oh. i am still moving, but now i am moving warmly."', from: 'anxiety asteroid', day: 'day 04', rot: 0.8 },
  ];
  return (
    <div className="ab parchment" style={{ height: '100%' }}>
      {/* top */}
      <div style={{ padding: '24px 32px 12px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', borderBottom: '1px solid var(--border)' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10,
            letterSpacing: 'var(--ls-pixel)', color: 'var(--terracotta)' }}>★ collection</span>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32,
            letterSpacing: 'var(--ls-tight)', lineHeight: 1, marginTop: 4 }}>
            memories you have made.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-mute)',
            marginTop: 6 }}>
            small things people gave you back. no rush — they're not going anywhere.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 11,
          alignItems: 'baseline' }}>
          <span><span style={{ color: 'var(--ink-mute)' }}>found</span> <b>14/60</b></span>
          <span><span style={{ color: 'var(--ink-mute)' }}>stickers</span> <b>6</b></span>
          <span><span style={{ color: 'var(--ink-mute)' }}>postcards</span> <b>3</b></span>
        </div>
      </div>

      {/* tabs */}
      <div style={{ padding: '14px 32px 0', display: 'flex', gap: 16 }}>
        <Tab active>all · 14</Tab>
        <Tab>notes · 8</Tab>
        <Tab>stickers · 6</Tab>
        <Tab>postcards · 3</Tab>
        <Tab>recipes · 2</Tab>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--ink-mute)' }}>sorted by day · newest</span>
      </div>

      {/* grid */}
      <div style={{ padding: '20px 32px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {memories.map(m => (
          <div key={m.id} style={{
            background: 'var(--parchment-warm)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: 14,
            transform: `rotate(${m.rot}deg)`, boxShadow: 'var(--shadow-md)',
            opacity: m.locked ? 0.55 : 1, position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9,
                letterSpacing: 'var(--ls-pixel)', color: 'var(--terracotta)' }}>★ MEMORY · 0{m.id}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-mute)' }}>{m.day}</span>
            </div>
            {m.locked ? (
              <div style={{
                background: 'var(--plaster)', border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--r-sm)', padding: 14, textAlign: 'center',
                fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)',
                color: 'var(--ink-mute)',
              }}>
                ◇ ◇ ◇<br/>not yet
              </div>
            ) : (
              <div style={{
                background: 'var(--plaster)', border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--r-sm)', padding: 12,
                fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13,
                color: 'var(--ink-soft)', lineHeight: 1.45,
              }}>{m.text}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <NpcPortrait size={32} bg={m.bg} ch={m.ch} mood="var(--sage)" />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-mute)' }}>
                {m.from}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Tab({ children, active }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 12,
      letterSpacing: '0.04em', textTransform: 'lowercase',
      padding: '6px 12px',
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--plaster)' : 'var(--ink-mute)',
      borderRadius: 'var(--r-sm)',
      border: active ? '1px solid var(--ink)' : '1px solid transparent',
      cursor: 'pointer',
    }}>{children}</span>
  );
}

// =============================================================================
// 21 · Pause menu
// =============================================================================
function GSPause() {
  return (
    <div className="ab cosmos-deep" style={{ height: '100%' }}>
      <StarField count={50} seed={12} />
      {/* faint game underneath suggestion */}
      <div style={{ position: 'absolute', right: 80, top: 80, opacity: 0.5 }}>
        <Planet index={3} size={220} glow="rgba(232,154,75,0.4)" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,22,38,0.55)',
        backdropFilter: 'blur(6px)' }} />

      <div style={{
        position: 'absolute', top: 60, left: 60, bottom: 60,
        width: 380, background: 'var(--parchment-warm)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 18,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10,
            letterSpacing: 'var(--ls-pixel)', color: 'var(--terracotta)' }}>★ paused</span>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 36,
            letterSpacing: 'var(--ls-tight)', lineHeight: 1, marginTop: 4 }}>
            take a breath.
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)',
            marginTop: 6 }}>
            the gyoza ship will wait. it always does.
          </div>
        </div>

        {/* menu items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <PauseItem label="resume flight"   keycap="ESC" primary glyph="play" />
          <PauseItem label="kitchen · toppings" glyph="cake" />
          <PauseItem label="galaxy map"       keycap="M" glyph="star" />
          <PauseItem label="delivery log"     keycap="L" glyph="note" />
          <PauseItem label="memories"         glyph="bell" />
          <PauseItem label="settings"         glyph="cog" />
          <PauseItem label="exit to title"    glyph="wave" muted />
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Eyebrow>now playing</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--plaster)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
            <PixelIcon glyph="play" size={16} color="var(--ember)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12 }}>noodle bay</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
                ost · 03:14 / 04:02
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button style={{ background: 'transparent', border: '1px solid var(--border)',
                width: 24, height: 24, borderRadius: 4, cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PixelIcon glyph="pause" size={10} color="var(--ink)" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* right: tiny journal preview */}
      <div style={{
        position: 'absolute', right: 60, bottom: 60, width: 380,
        background: 'rgba(20,22,38,0.78)', border: '1px solid rgba(247,240,220,0.18)',
        borderRadius: 'var(--r-md)', padding: 18, color: 'var(--plaster)',
      }}>
        <Eyebrow style={{ color: 'rgba(251,247,236,0.55)', marginBottom: 8 }}>today, so far</Eyebrow>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
          <li><span style={{ color: 'var(--sage-soft)' }}>✓</span> &nbsp;tea moon · hot tea capsule</li>
          <li><span style={{ color: 'var(--sage-soft)' }}>✓</span> &nbsp;bento belt · rice ball repair kit</li>
          <li><span style={{ color: 'var(--ember-soft)' }}>→</span> &nbsp;mossport · takoyaki <span style={{ color: 'rgba(251,247,236,0.45)' }}>(in transit)</span></li>
          <li style={{ color: 'rgba(251,247,236,0.5)' }}><span>○</span> &nbsp;planet "i'm fine" · soup + blanket</li>
          <li style={{ color: 'rgba(251,247,236,0.5)' }}><span>○</span> &nbsp;sleepy satellite · cocoa capsule</li>
        </ul>
      </div>
    </div>
  );
}
function PauseItem({ label, keycap, primary, glyph, muted }) {
  return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--plaster)' : (muted ? 'var(--ink-mute)' : 'var(--ink)'),
      border: '1px solid ' + (primary ? 'var(--ink)' : 'var(--border)'),
      borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
      letterSpacing: 'var(--ls-tight)', cursor: 'pointer', textAlign: 'left',
    }}>
      <PixelIcon glyph={glyph} size={16} color={primary ? 'var(--ember-soft)' : (muted ? 'var(--ink-mute)' : 'var(--ink)')} />
      <span>{label}</span>
      {keycap && (
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10,
          background: primary ? 'rgba(247,240,220,0.18)' : 'var(--parchment-deep)',
          color: primary ? 'var(--plaster)' : 'var(--ink-mute)',
          padding: '2px 6px', borderRadius: 3,
        }}>{keycap}</span>
      )}
    </button>
  );
}

// =============================================================================
// 22 · Ending
// =============================================================================
function GSEnding() {
  return (
    <div className="ab cosmos" style={{ height: '100%' }}>
      <StarField count={140} seed={14} />
      {/* a quiet big planet, low */}
      <div style={{ position: 'absolute', bottom: -200, left: -120 }}>
        <Planet index={0} size={520} glow="rgba(232,154,75,0.4)" />
      </div>
      {/* gyoza in center */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        <GyozaSprite size={140} />
        <div style={{ textAlign: 'center', maxWidth: 720 }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 11,
            letterSpacing: 'var(--ls-pixel)', color: 'var(--ember-soft)' }}>
            ★ INCOMING PACKAGE · RECIPIENT: GYOZA SHIP
          </span>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 42,
            color: 'var(--plaster)', letterSpacing: 'var(--ls-tight)', lineHeight: 1.1, marginTop: 14,
          }}>
            you crossed cold space<br/>carrying warm things.<br/>that matters.
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ember-soft)',
            marginTop: 22, fontStyle: 'italic',
          }}>
            also, your left thruster is still making soup noises.
          </div>
        </div>
      </div>

      {/* bottom credits + stickers shelf */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '20px 32px',
        background: 'linear-gradient(to top, rgba(20,22,38,0.85), transparent)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,236,0.55)' }}>
          <div style={{ marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'rgba(251,247,236,0.4)' }}>final tally · day 12</div>
          delivered <b style={{ color: 'var(--plaster)' }}>24/24</b>
          &nbsp;·&nbsp; memories <b style={{ color: 'var(--plaster)' }}>60/60</b>
          &nbsp;·&nbsp; gyoza incidents <b style={{ color: 'var(--ember-soft)' }}>17</b>
        </div>
        {/* sticker shelf */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[14, 13, 12, 11, 10, 9].map((n, i) => (
            <div key={n} style={{
              width: 44, height: 44, background: 'var(--plaster)',
              borderRadius: 6, border: '2px solid var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `rotate(${(i % 2 ? 1 : -1) * 4}deg)`,
              fontFamily: 'var(--font-pixel)', fontSize: 11, color: 'var(--ink)',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.6)',
            }}>★{n}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <BtnInk>roll credits</BtnInk>
          <button style={{
            background: 'var(--ember)', color: 'var(--ink)',
            border: '2px solid var(--ink)', borderRadius: 0,
            padding: '8px 14px', fontFamily: 'var(--font-pixel)', fontSize: 11,
            letterSpacing: 'var(--ls-pixel)', textTransform: 'uppercase',
            boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer',
          }}>+1 free drift</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  GSTitle, GSModeSelect, GSGalaxyMap, GSBriefing, GSCockpit,
  GSCrash, GSSuccess, GSMemories, GSPause, GSEnding,
});
