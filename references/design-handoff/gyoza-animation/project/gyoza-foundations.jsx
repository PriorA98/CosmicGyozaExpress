// gyoza-foundations.jsx — Foundations section artboards
const { BoardHeader, StarField, Tag, ShipGlyph, GyozaSprite, PixelIcon, Eyebrow } = window;

// =============================================================================
// 01 · Brand Mark
// =============================================================================
function GFLogoBoard() {
  return (
    <div className="ab cosmos">
      <StarField count={80} seed={3} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        padding: 36, gap: 36, alignItems: 'center',
      }}>
        {/* logo block */}
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
            textTransform: 'uppercase', color: 'rgba(251,247,236,0.55)', marginBottom: 14,
          }}>
            primary lockup · dark
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <GyozaSprite size={120} />
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 56,
                lineHeight: 0.95, letterSpacing: '-0.025em', color: 'var(--plaster)',
              }}>
                gyoza<br/>galaxy<br/>delivery
              </div>
              <div style={{
                marginTop: 10, fontFamily: 'var(--font-pixel)', fontSize: 11,
                letterSpacing: 'var(--ls-pixel)', color: 'var(--ember-soft)',
              }}>
                a small ship · doing its best
              </div>
            </div>
          </div>

          <div style={{ marginTop: 36, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Tag color="ghost">cozy</Tag>
            <Tag color="ghost">physics-y</Tag>
            <Tag color="ghost">funny</Tag>
            <Tag color="ghost">warm</Tag>
            <Tag color="ghost">handmade</Tag>
          </div>
        </div>

        {/* alt lockups + parchment treatment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* parchment mark */}
          <div style={{
            background: 'var(--parchment-warm)', borderRadius: 'var(--r-lg)',
            padding: '20px 22px', border: '1px solid var(--border)',
            color: 'var(--ink)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: 'var(--ls-wide)',
              textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
              parchment / light surface
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <GyozaSprite size={48} />
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24,
                  letterSpacing: 'var(--ls-tight)', lineHeight: 1,
                }}>delivery gyoza</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                  across the galaxy · v0.3
                </div>
              </div>
            </div>
          </div>

          {/* monogram */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
            <div style={{
              flex: '0 0 auto', background: 'var(--terracotta)', color: '#FBF7EC',
              padding: 16, borderRadius: 'var(--r-md)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: '3px 3px 0 var(--ink)',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38,
                lineHeight: 1, letterSpacing: '-0.04em',
              }}>g.</div>
            </div>
            <div style={{
              flex: 1, background: 'var(--ink)', color: 'var(--plaster)',
              padding: 14, borderRadius: 'var(--r-md)', display: 'flex',
              alignItems: 'center', gap: 12,
            }}>
              <ShipGlyph size={36} />
              <div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)',
                  color: 'var(--ember-soft)' }}>cosmic courier ·</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.06em', marginTop: 2 }}>gyoza · 01</div>
              </div>
            </div>
          </div>

          {/* tagline cluster */}
          <div style={{ padding: '10px 12px', borderTop: '1px dashed rgba(251,247,236,0.18)',
            color: 'rgba(251,247,236,0.7)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-wide)',
              textTransform: 'uppercase', marginBottom: 6, color: 'rgba(251,247,236,0.55)' }}>taglines</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.45 }}>
              "i am a tiny dumpling ship<br/>delivering comfort across the galaxy,<br/>and somehow this matters."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 02 · Palette
// =============================================================================
function Swatch({ name, varName, hex, ink = false, style }) {
  return (
    <div style={{
      background: hex, color: ink ? 'var(--ink)' : 'var(--plaster)',
      borderRadius: 'var(--r-sm)', padding: '10px 12px',
      minHeight: 78, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.18)',
      ...style,
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13.5, letterSpacing: 'var(--ls-tight)' }}>
        {name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, opacity: 0.82, letterSpacing: '0.04em' }}>
          {varName}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, opacity: 0.82 }}>{hex}</span>
      </div>
    </div>
  );
}
function PaletteRow({ label, swatches }) {
  return (
    <div>
      <Eyebrow style={{ marginBottom: 6 }}>{label}</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${swatches.length}, 1fr)`, gap: 6 }}>
        {swatches.map((s, i) => <Swatch key={i} {...s} />)}
      </div>
    </div>
  );
}
function GFPaletteBoard() {
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="foundations"
        title="The cozy-cosmos palette"
        subtitle="warm parchment for ui, deep cosmos for canvas, terracotta for action. one tiny ship, one big quiet galaxy."
      />
      <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PaletteRow
          label="cosmos · canvas backgrounds"
          swatches={[
            { name: 'void',         varName: '--ink',         hex: '#1A1B2E' },
            { name: 'dusk',         varName: '--ink-soft',    hex: '#2F3149' },
            { name: 'nebula plum',  varName: '--plum',        hex: '#9B8FB8' },
            { name: 'dusk blue',    varName: '--dusk-blue',   hex: '#9EB6C4' },
            { name: 'teal drift',   varName: '--teal',        hex: '#6FA39A' },
          ]}
        />
        <PaletteRow
          label="parchment · paper / ui"
          swatches={[
            { name: 'parchment',      varName: '--parchment',      hex: '#F4ECDC', ink: true },
            { name: 'parchment warm', varName: '--parchment-warm', hex: '#F9F3E5', ink: true },
            { name: 'parchment deep', varName: '--parchment-deep', hex: '#ECDFC5', ink: true },
            { name: 'plaster',        varName: '--plaster',        hex: '#FBF7EC', ink: true },
            { name: 'wallpaper',      varName: '--wallpaper',      hex: '#E8D9BD', ink: true },
          ]}
        />
        <PaletteRow
          label="action · gyoza-warm accents"
          swatches={[
            { name: 'terracotta',   varName: '--terracotta', hex: '#C97B5A' },
            { name: 'ember',        varName: '--ember',      hex: '#E08A4B' },
            { name: 'amber',        varName: '--amber',      hex: '#D4A055' },
            { name: 'brick',        varName: '--brick',      hex: '#C26954' },
            { name: 'rose',         varName: '--rose',       hex: '#C490A8' },
          ]}
        />
        <PaletteRow
          label="states · pet activity / mission status"
          swatches={[
            { name: 'idle · sage',    varName: '--sage',        hex: '#8DA17A' },
            { name: 'waiting · ember',varName: '--ember',       hex: '#E08A4B' },
            { name: 'flying · run',   varName: '--state-running-dot', hex: '#5A8B5E' },
            { name: 'thinking · plum',varName: '--plum',        hex: '#9B8FB8' },
            { name: 'error · brick',  varName: '--brick',       hex: '#C26954' },
          ]}
        />
      </div>
    </div>
  );
}

// =============================================================================
// 03 · Typography
// =============================================================================
function GFTypeBoard() {
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="foundations"
        title="Type scale"
        subtitle="bricolage for warmth, geist for ui, jetbrains mono for instruments, silkscreen for pixel labels."
      />
      <div style={{ padding: '0 28px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: 22 }}>
        {/* display */}
        <div>
          <Eyebrow>bricolage grotesque · display</Eyebrow>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 56, lineHeight: 0.95,
            letterSpacing: 'var(--ls-tight)' }}>
            gyoza galaxy delivery
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, marginTop: 6,
            letterSpacing: 'var(--ls-tight)', color: 'var(--ink-soft)' }}>
            mossport · the porra ribbon
          </div>
        </div>

        {/* ui body + meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
          <div>
            <Eyebrow>geist · ui body</Eyebrow>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, maxWidth: 380 }}>
              gloop on mossport sent a request. they didn't say it was urgent. it doesn't matter — the gyoza ship is on its way with hot food and a bad joke. nothing here is calorie-counted. nothing is judged.
            </div>
          </div>
          <div>
            <Eyebrow>jetbrains mono · readouts</Eyebrow>
            <pre style={{
              margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55,
              color: 'var(--ink)', background: 'var(--parchment-deep)',
              padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
            }}>
{`> velocity   124.3 px/s
> heading    287°
> drift      0.04
> package    cozy
> pilot      doing its best`}
            </pre>
          </div>
        </div>

        {/* pixel + caps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <div>
            <Eyebrow>silkscreen · pixel labels</Eyebrow>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, letterSpacing: 'var(--ls-pixel)',
              textTransform: 'uppercase', color: 'var(--ink)' }}>
              PRESS E TO DESCEND
            </div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: 'var(--ls-pixel)',
              textTransform: 'uppercase', color: 'var(--ember)', marginTop: 8 }}>
              ▎ZZZ · LAST ACTIVE 12 MIN AGO
            </div>
          </div>
          <div>
            <Eyebrow>uppercase mono · pill copy</Eyebrow>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
                textTransform: 'uppercase', background: 'var(--state-running-bg)',
                color: 'var(--state-running-fg)', padding: '3px 9px', borderRadius: 999 }}>FLYING</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
                textTransform: 'uppercase', background: 'var(--state-waiting-bg)',
                color: 'var(--state-waiting-fg)', padding: '3px 9px', borderRadius: 999 }}>DOCKING</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em',
                textTransform: 'uppercase', background: 'var(--state-error-bg)',
                color: 'var(--state-error-fg)', padding: '3px 9px', borderRadius: 999 }}>GYOZA INCIDENT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 04 · Iconography (pixel)
// =============================================================================
function GFIconBoard() {
  const set1 = ['thrust','fuel','package','radar','speed','drift','crash','star','soup','chili','moon'];
  const set2 = ['crab','cake','blanket','note','cocoa','pause','play','chev','cog','locked','home'];
  const props = ['tea','bell','wave'];
  return (
    <div className="ab parchment">
      <BoardHeader
        kicker="foundations"
        title="Pixel iconography"
        subtitle="all icons live on a 6×6 pixel cell. ink-on-parchment. food + emotion + instrument glyphs only — no generic ui filler."
      />
      <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Eyebrow>instruments · dashboard</Eyebrow>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {set1.map(g => <IconCell key={g} glyph={g} />)}
          </div>
        </div>
        <div>
          <Eyebrow>delivery items + ui controls</Eyebrow>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {set2.map(g => <IconCell key={g} glyph={g} />)}
            {props.map(g => <IconCell key={g} glyph={g} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
function IconCell({ glyph }) {
  return (
    <div style={{
      width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 10, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)', gap: 8,
    }}>
      <PixelIcon glyph={glyph} size={32} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-mute)',
        letterSpacing: '0.04em' }}>{glyph}</span>
    </div>
  );
}

Object.assign(window, { GFLogoBoard, GFPaletteBoard, GFTypeBoard, GFIconBoard });
