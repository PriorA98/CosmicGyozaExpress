import { colors } from "../game/designTokens";
import type { UiIconName } from "../data/assetManifest";

/**
 * Tiny 8x8 stand-in glyphs for the `ui-icons` strip, drawn at 2 art px per glyph pixel so they
 * match the 16x16 authored frames. Used only while `assets/ui/icons.png` is missing.
 * Palette: '.' transparent, k ink, p plaster, e ember, a amber, s sage, d dusk blue, t teal,
 * r terracotta, b brick.
 */
export const ICON_GLYPH_PALETTE: Readonly<Record<string, string>> = {
  k: colors.ink,
  p: colors.plaster,
  e: colors.ember,
  a: colors.amber,
  s: colors.sage,
  d: colors.duskBlue,
  t: colors.teal,
  r: colors.terracotta,
  b: colors.brick,
};

export const ICON_GLYPHS: Readonly<Record<UiIconName, readonly string[]>> = {
  thrust: ["...ee...", "...ee...", "..eaae..", "..eaae..", ".eappae.", ".eappae.", "..eaae..", "...ee..."],
  // Crescent dumpling with pleats, matching the authored golden gyoza frame.
  package: ["........", "...kkk..", "..kaaak.", ".kakakak", "kaaaaaak", "kaaaaaak", ".kkkkkk.", "........"],
  radar: ["..dddd..", ".d....d.", "d..dd..d", "d.d..d.d", "d.d.pd.d", "d..dd..d", ".d....d.", "..dddd.."],
  speed: ["........", "e...e...", ".e...e..", "..e...e.", "..e...e.", ".e...e..", "e...e...", "........"],
  drift: ["........", ".tt..tt.", "t..tt..t", "........", ".tt..tt.", "t..tt..t", "........", "........"],
  incident: ["...b....", "b..b..b.", ".b.b.b..", "..bbb...", "bbbpbbb.", "..bbb...", ".b.b.b..", "b..b..b."],
  memory: ["...a....", "...a....", "..aaa...", "aaaaaaa.", ".aaaaa..", "..aaa...", ".aa.aa..", ".a...a.."],
  moon: ["..aaaa..", ".aaaa...", "aaa.....", "aaa.....", "aaa.....", "aaa.....", ".aaaa...", "..aaaa.."],
  tea: ["..p..p..", ".p..p...", "........", "tttttttt", "tsssst.t", "tsssstt.", ".tttt...", "........"],
  pause: ["........", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", ".pp..pp.", "........"],
  settings: ["...dd...", ".dddddd.", ".dd..dd.", "ddd..ddd", "ddd..ddd", ".dd..dd.", ".dddddd.", "...dd..."],
  home: ["...rr...", "..rrrr..", ".rrrrrr.", "rrrrrrrr", ".pppppp.", ".pp..pp.", ".pp..pp.", ".pp..pp."],
  soundOn: ["...p....", "..pp..e.", "pppp.e..", "pppp.e.e", "pppp.e.e", "pppp.e..", "..pp..e.", "...p...."],
  soundOff: ["...p....", "..pp....", "pppp....", "pppp.b.b", "pppp..b.", "pppp.b.b", "..pp....", "...p...."],
  keyboard: ["........", "pppppppp", "pkpkpkpk", "pppppppp", "pkpkpkpk", "pppppppp", "pkkkkkkp", "pppppppp"],
  touch: ["...pp...", "...pp...", "...pp...", "...pppp.", ".ppppppp", ".ppppppp", "..ppppp.", "..ppppp."],
};

export const ICON_GLYPH_SIZE = 8;

/**
 * Full-resolution (16x16 art px) bitmaps painted by the DOM mute toast (`SoundToast`), which
 * cannot sample the Phaser texture. They no longer patch the `ui-icons` strip: wave 2 re-exported
 * icons.png with authored package / sound frames. Same palette keys as above plus
 * o ember, d terracotta-deep, c parchment-deep.
 */
export const ICON_OVERRIDE_PALETTE: Readonly<Record<string, string>> = {
  ...ICON_GLYPH_PALETTE,
  o: colors.ember,
  d: colors.terracottaDeep,
  e: colors.amber,
  c: colors.parchmentDeep,
};

export const ICON_OVERRIDE_SIZE = 16;

export const ICON_OVERRIDES: Readonly<Partial<Record<UiIconName, readonly string[]>>> = {
  // Legacy fallback only (not drawn at runtime: SoundToast paints soundOn/soundOff). The authored
  // ui-icons frame 1 is now a golden pleated gyoza; see ICON_GLYPHS.package for the 8x8 fallback.
  package: [
    "................",
    "....kk....kk....",
    "...koek..keok...",
    "...kooekkeook...",
    "....kkoddokk....",
    "..kkkkddddkkkk..",
    ".kooooodooooook.",
    ".kooooodoooooek.",
    ".koooooodooooek.",
    ".kopooooodoooek.",
    ".koooooooodoook.",
    ".kooopooooodpok.",
    ".krooooooooodrk.",
    "..krrrrrrrrrrk..",
    "...kkkkkkkkkk...",
    "................",
  ],
  // Cream speaker with two clean, separated amber arcs.
  soundOn: [
    "................",
    "...........kk...",
    "......k.....ka..",
    ".....kpk.k...ka.",
    "....kppk..ka..ka",
    "kkkkpppk...ka.ka",
    "kppppppk...ka.ka",
    "kppppppk...ka.ka",
    "kppppppk...ka.ka",
    "kccccppk...ka.ka",
    "kkkkcppk..ka..ka",
    "....kcpk.k...ka.",
    ".....kck....ka..",
    "......k....kk...",
    "................",
    "................",
  ],
  // Same speaker, quiet: a small brick cross where the arcs were.
  soundOff: [
    "................",
    "................",
    "......k.........",
    ".....kpk........",
    "....kppk........",
    "kkkkpppk.bb..bb.",
    "kppppppk..bbbb..",
    "kppppppk...bb...",
    "kppppppk..bbbb..",
    "kccccppk.bb..bb.",
    "kkkkcppk........",
    "....kcpk........",
    ".....kck........",
    "......k.........",
    "................",
    "................",
  ],
};
