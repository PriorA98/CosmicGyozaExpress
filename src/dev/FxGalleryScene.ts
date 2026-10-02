import Phaser from "phaser";
import { ASSET, SHIP_ART } from "../data/assetManifest";
import { rotationCellIndex } from "../entities/GyozaShip";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../game/designTokens";
import { emitGameEvent, onGameEvent, type GameEvent } from "../game/events";
import {
  burstDust,
  burstIncident,
  burstSparkles,
  burstStars,
  createNozzleGlow,
  createPixelFlame,
  createSteam,
  createThrustTrail,
  flashScreen,
  isReducedMotion,
  liveParticleCount,
  setReducedMotion,
  settleBursts,
  shakeCamera,
  squash,
  type NozzleGlow,
  type PixelFlame,
  type ThrustTrail,
} from "../fx/feedback";
import { playEnterTransition, transitionToScene, type TransitionSpec } from "../fx/transitions";
import { registerDevState } from "./devProbe";

/**
 * Dev-only gallery of the src/fx effects and audio cues (owner: audio-fx package). Opened with
 * `?showcase=fx-gallery`. Never registered in production builds.
 *
 * Every particle effect loops in its own cell so one screenshot shows them all mid-flight.
 * Keys: 1 flash · 2 soft shake · 3 strong shake · 4 iris · 5 warm fade · 6 warp · 7 handoff · R reduced motion.
 * The chips along the bottom trigger fx recipes or emit real GameEvents (the AudioSystem plays the mapped cue).
 */

type GalleryData = { readonly enter?: TransitionSpec };

type Cell = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly cx: number; readonly cy: number };

/** Cells on a 4-column grid; the cruise cell spans two columns so a 2x ship can orbit in it. */
const GRID = { cols: 4, cellW: 296, cellH: 236, gap: 16, top: 70 } as const;
const CELLS: readonly { readonly col: number; readonly row: number; readonly span: number; readonly label: string }[] = [
  { col: 0, row: 0, span: 2, label: "thrust · cruise orbit (ship + puffs at 2x)" },
  { col: 2, row: 0, span: 1, label: "pixel nozzle flame · hover" },
  { col: 3, row: 0, span: 1, label: "dust puff" },
  { col: 0, row: 1, span: 1, label: "sparkles" },
  { col: 1, row: 1, span: 1, label: "gyoza incident" },
  { col: 2, row: 1, span: 1, label: "star twinkle" },
  { col: 3, row: 1, span: 1, label: "steam" },
];
const CELL = { cruise: 0, hover: 1, dust: 2, sparkle: 3, incident: 4, stars: 5, steam: 6 } as const;
/**
 * Ship rotation contract: pixel art is never rotated at runtime. The gallery ships show the
 * RotSprite-baked angle cell nearest their heading (cells are centred on the saucer pivot).
 */
const SHIP_ROT_ORIGIN = 0.5;
/** Art px below the saucer centre: trail (below the baked flame) and nozzle (saucer underside). */
const SHIP_TRAIL_OFFSET = 30 * SHIP_ART.artScale;
const SHIP_NOZZLE_OFFSET = 14 * SHIP_ART.artScale;
/** Ground line for the touchdown side-fan demo, below the dust cell centre (px). */
const DUST_GROUND_DY = 74;
const ORBIT = { radiusX: 196, radiusY: 26, periodMs: 4200 } as const;
// Intervals are shorter than each burst's lifespan so any single capture shows live particles.
const BURST_LOOPS = [
  { cell: CELL.dust, everyMs: 650 },
  { cell: CELL.sparkle, everyMs: 700 },
  { cell: CELL.incident, everyMs: 950 },
  { cell: CELL.stars, everyMs: 800 },
] as const;

const AUDIO_CHIPS: readonly { readonly label: string; readonly event: GameEvent }[] = [
  { label: "hover", event: { type: "ui:hover" } },
  { label: "confirm", event: { type: "ui:confirm" } },
  { label: "back", event: { type: "ui:back" } },
  { label: "brake", event: { type: "flight:brake", active: true } },
  { label: "bump", event: { type: "flight:bump", severity: "soft-bump", x: 0, y: 0 } },
  { label: "bump!!", event: { type: "flight:bump", severity: "dramatic-bump", x: 0, y: 0 } },
  { label: "incident", event: { type: "landing:incident", incident: "hard-drop", x: 0, y: 0 } },
  { label: "respawn", event: { type: "flight:respawn" } },
  { label: "arrival", event: { type: "flight:arrival-complete" } },
  { label: "touch soft", event: { type: "landing:touchdown", result: "soft", x: 0, y: 0 } },
  { label: "touch bumpy", event: { type: "landing:touchdown", result: "bumpy", x: 0, y: 0 } },
  { label: "retry", event: { type: "landing:retry" } },
  { label: "jingle", event: { type: "result:shown", landingResult: "soft" } },
];

type ParticleSample = { readonly alpha: number; readonly tint: number; readonly frame: string | number; readonly lifeT: number };

/** First live particle of an emitter, summarised for the dev probe (tuning checks without eyes). */
function sampleParticle(emitter: Phaser.GameObjects.Particles.ParticleEmitter): ParticleSample | null {
  const samples: ParticleSample[] = [];
  emitter.forEachAlive((particle) => {
    if (samples.length === 0) samples.push({ alpha: particle.alpha, tint: particle.tint, frame: particle.frame.name, lifeT: particle.lifeT });
  }, undefined);
  return samples[0] ?? null;
}

export class FxGalleryScene extends Phaser.Scene {
  private readonly cells: Cell[] = [];
  private readonly trails: ThrustTrail[] = [];
  private readonly stopSteam: (() => void)[] = [];
  private orbitShip: Phaser.GameObjects.Image | null = null;
  private hoverShip: Phaser.GameObjects.Image | null = null;
  private hoverFlame: PixelFlame | null = null;
  private orbitGlow: NozzleGlow | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private muteText: Phaser.GameObjects.Text | null = null;
  private elapsedMs = 0;
  private readonly burstClock = new Map<number, number>();

  constructor() {
    super("FxGalleryScene");
  }

  create(data: GalleryData = {}): void {
    const { width, height } = this.scale;
    this.cells.length = 0;
    this.trails.length = 0;
    this.stopSteam.length = 0;
    this.elapsedMs = 0;
    this.burstClock.clear();
    this.hoverFlame = null;
    this.orbitGlow = null;

    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmosDeep)).setOrigin(0, 0).setDepth(depth.backdrop);
    this.add
      .text(24, 26, "fx gallery", { color: colors.parchment, fontFamily: fontStacks.display, fontSize: `${typeScale.xl}px` })
      .setOrigin(0, 0.5);
    this.add
      .text(width - 24, 26, "1 flash · 2/3 shake · 4 iris · 5 fade · 6 warp · 7 handoff · R reduced motion · M mute", {
        color: colors.duskBlue,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
      })
      .setOrigin(1, 0.5);

    this.layoutCells();
    this.buildThrustCells();
    this.buildSteamCell();
    this.buildChipStrips();
    this.bindKeys();

    this.statusText = this.add
      .text(24, height - 14, "", { color: colors.borderStrong, fontFamily: fontStacks.mono, fontSize: `${typeScale.xs}px` })
      .setOrigin(0, 1);
    this.muteText = this.add
      .text(width - 24, height - 14, "", { color: colors.amber, fontFamily: fontStacks.mono, fontSize: `${typeScale.xs}px` })
      .setOrigin(1, 1);

    // Every loop fires on the first frame, then keeps overlapping bursts alive.
    for (const loop of BURST_LOOPS) this.burstClock.set(loop.cell, loop.everyMs);

    // Shows the audio:mute event round trip (the HUD owns the in-game toast).
    const unsubscribe = onGameEvent(this.game, (event) => {
      if (event.type === "audio:mute") this.muteText?.setText(`audio:mute -> ${event.muted ? "sound off" : "sound on"}`);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      for (const trail of this.trails) trail.destroy();
      for (const stop of this.stopSteam) stop();
      this.hoverFlame?.destroy();
      this.hoverFlame = null;
      this.orbitGlow?.destroy();
      this.orbitGlow = null;
    });

    registerDevState("fx", () => ({
      liveParticles: liveParticleCount(this),
      reducedMotion: isReducedMotion(),
      flamePower: this.hoverFlame?.power ?? 0,
      emitters: this.children.list
        .filter((child): child is Phaser.GameObjects.Particles.ParticleEmitter => child instanceof Phaser.GameObjects.Particles.ParticleEmitter)
        .map((emitter) => ({
          texture: emitter.texture.key,
          alive: emitter.getAliveParticleCount(),
          sample: sampleParticle(emitter),
        })),
    }));
    emitGameEvent(this, { type: "scene:enter", scene: "FxGalleryScene" });
    if (data.enter) void playEnterTransition(this, data.enter);
  }

  update(_time: number, delta: number): void {
    this.elapsedMs += delta;
    this.updateThrust(delta);

    for (const loop of BURST_LOOPS) {
      const next = (this.burstClock.get(loop.cell) ?? 0) + delta;
      if (next >= loop.everyMs) {
        this.burstClock.set(loop.cell, next - loop.everyMs);
        this.fireBurst(loop.cell);
      } else {
        this.burstClock.set(loop.cell, next);
      }
    }

    if (this.statusText) {
      const audio = window.__CGE__?.getState("audio") as { contextState?: string; muted?: boolean } | undefined;
      this.statusText.setText(
        `live particles ${liveParticleCount(this).toString().padStart(3, " ")} / 300 · reduced motion ${isReducedMotion() ? "on" : "off"} · audio ${audio?.contextState ?? "?"}${audio?.muted ? " (muted, M)" : " (M mutes)"}`,
      );
    }
  }

  private layoutCells(): void {
    const totalW = GRID.cols * GRID.cellW + (GRID.cols - 1) * GRID.gap;
    const left = Math.round((this.scale.width - totalW) / 2);
    for (const spec of CELLS) {
      const x = left + spec.col * (GRID.cellW + GRID.gap);
      const y = GRID.top + spec.row * (GRID.cellH + GRID.gap);
      const w = spec.span * GRID.cellW + (spec.span - 1) * GRID.gap;
      const cell: Cell = { x, y, w, h: GRID.cellH, cx: Math.round(x + w / 2), cy: Math.round(y + GRID.cellH / 2 + 10) };
      this.cells.push(cell);
      this.add
        .rectangle(x, y, w, GRID.cellH, colorNumber(colors.cosmosPanel))
        .setOrigin(0, 0)
        .setStrokeStyle(2, colorNumber(colors.inkSoft))
        .setDepth(depth.backdrop);
      this.add
        .text(x + 12, y + 12, spec.label, { color: colors.parchmentDeep, fontFamily: fontStacks.mono, fontSize: `${typeScale.sm}px` })
        .setDepth(depth.hud);
    }
  }

  private cell(index: number): Cell {
    const cell = this.cells[index];
    if (!cell) throw new Error(`fx gallery cell ${index} missing`);
    return cell;
  }

  private buildThrustCells(): void {
    const orbit = this.cell(CELL.cruise);
    this.orbitShip = this.add
      .image(orbit.cx, orbit.cy, ASSET.shipFly2Rot, 0)
      .setOrigin(SHIP_ROT_ORIGIN, SHIP_ROT_ORIGIN)
      .setScale(SHIP_ART.artScale)
      .setDepth(depth.ship);
    this.trails.push(createThrustTrail(this, { offset: SHIP_TRAIL_OFFSET, depth: depth.ship - 1 }));
    // Stepped pixel nozzle light (the flight ShipEngine recipe): two hard levels, no gradient.
    this.orbitGlow = createNozzleGlow(this, { depth: depth.ship - 0.5 });

    const hover = this.cell(CELL.hover);
    this.hoverShip = this.add
      .image(hover.cx, hover.cy - 40, ASSET.shipIdleRot, 0)
      .setOrigin(SHIP_ROT_ORIGIN, SHIP_ROT_ORIGIN)
      .setScale(SHIP_ART.artScale)
      .setDepth(depth.ship);
    this.trails.push(createThrustTrail(this, { offset: SHIP_TRAIL_OFFSET, depth: depth.ship - 1 }));
    this.hoverFlame = createPixelFlame(this, { depth: depth.ship - 0.5 });
    this.add.rectangle(hover.cx, hover.y + hover.h - 18, 150, 6, colorNumber(colors.sageDeep)).setDepth(depth.world);
    // Ground line under the touchdown side fans in the dust cell.
    const dust = this.cell(CELL.dust);
    this.add.rectangle(dust.cx, dust.cy + DUST_GROUND_DY + 8, 150, 6, colorNumber(colors.sageDeep)).setDepth(depth.world);
  }

  private updateThrust(delta: number): void {
    const [orbitTrail, hoverTrail] = this.trails;
    if (this.orbitShip && orbitTrail) {
      const orbit = this.cell(CELL.cruise);
      const phase = (this.elapsedMs / ORBIT.periodMs) * Math.PI * 2;
      const x = Math.round(orbit.cx + Math.cos(phase) * ORBIT.radiusX);
      const y = Math.round(orbit.cy + Math.sin(phase) * ORBIT.radiusY);
      // Nose follows the orbit tangent (ship convention: 0 = up, clockwise): nose = (sin r, -cos r).
      const rotation = Math.atan2(-Math.sin(phase) * ORBIT.radiusX, -Math.cos(phase) * ORBIT.radiusY);
      this.orbitShip.setPosition(x, y).setFrame(rotationCellIndex(rotation));
      const intensity = 0.6 + 0.4 * Math.sin(phase * 2);
      orbitTrail.update(x, y, rotation, true, intensity);
      const nozzleX = x - Math.sin(rotation) * SHIP_NOZZLE_OFFSET;
      const nozzleY = y + Math.cos(rotation) * SHIP_NOZZLE_OFFSET;
      this.orbitGlow?.update(nozzleX, nozzleY, rotation, intensity > 0.5 ? "full" : "idle", this.elapsedMs);
    }
    if (this.hoverShip && hoverTrail) {
      const hover = this.cell(CELL.hover);
      const sway = Math.sin(this.elapsedMs / 700) * 0.12;
      const bob = Math.round(Math.sin(this.elapsedMs / 450) * 2) * SHIP_ART.artScale;
      const firing = Math.floor(this.elapsedMs / 1400) % 3 !== 2;
      const y = hover.cy - 40 + bob;
      // Position and baked cell only: the image itself is never recreated, cropped or rotated.
      this.hoverShip.setPosition(hover.cx, y).setFrame(rotationCellIndex(sway));
      hoverTrail.update(hover.cx, y, sway, firing, 1);
      const nozzleX = hover.cx - Math.sin(sway) * SHIP_NOZZLE_OFFSET;
      const nozzleY = y + Math.cos(sway) * SHIP_NOZZLE_OFFSET;
      this.hoverFlame?.update(nozzleX, nozzleY, sway, firing, this.elapsedMs, delta);
    }
  }

  private fireBurst(index: number): void {
    const cell = this.cell(index);
    switch (index) {
      case CELL.dust:
        burstDust(this, cell.cx, cell.cy + 10, { spread: 70 });
        // Touchdown feet: two low side fans rolling outward along a ground line.
        burstDust(this, cell.cx - 26, cell.cy + DUST_GROUND_DY, { count: 4, spread: 60, fan: "left" });
        burstDust(this, cell.cx + 26, cell.cy + DUST_GROUND_DY, { count: 4, spread: 60, fan: "right" });
        return;
      case CELL.sparkle:
        burstSparkles(this, cell.cx, cell.cy + 20);
        return;
      case CELL.incident:
        burstIncident(this, cell.cx, cell.cy + 10);
        return;
      case CELL.stars:
        burstStars(this, cell.cx, cell.cy, { spread: 60 });
        return;
    }
  }

  private buildSteamCell(): void {
    const cell = this.cell(CELL.steam);
    const cups = [-70, 0, 70];
    for (const dx of cups) {
      const cup = this.add.image(cell.cx + dx, cell.cy + 50, ASSET.itemTea).setScale(2).setDepth(depth.world);
      this.stopSteam.push(createSteam(this, cup.x, cup.y - cup.displayHeight / 2 - 4));
    }
  }

  private fxActions(): readonly (readonly [string, () => void])[] {
    const focus = this.cell(CELL.hover);
    return [
      ["flash 1", () => flashScreen(this)],
      ["shake 2", () => shakeCamera(this, "soft")],
      ["shake!! 3", () => shakeCamera(this, "strong")],
      ["iris 4", () => this.restartWith({ kind: "iris", x: focus.cx, y: focus.cy })],
      ["fade 5", () => this.restartWith({ kind: "warm-fade" })],
      ["warp 6", () => this.restartWith({ kind: "warp" })],
      ["handoff 7", () => this.restartWith({ kind: "handoff", x: focus.cx, y: focus.cy - 40 })],
      ["squash", () => (this.hoverShip ? squash(this, this.hoverShip, 0.12) : undefined)],
      ["settle bursts", () => settleBursts(this)],
    ];
  }

  private chip(x: number, y: number, label: string, run: () => void, accent: boolean): Phaser.GameObjects.Text {
    const base = accent ? colors.parchmentWarm : colors.parchment;
    const text = this.add
      .text(x, y, label, { color: colors.ink, backgroundColor: base, fontFamily: fontStacks.mono, fontSize: `${typeScale.sm}px`, padding: { x: 8, y: 4 } })
      .setDepth(depth.hud)
      .setInteractive({ useHandCursor: true });
    text.on(Phaser.Input.Events.POINTER_OVER, () => text.setBackgroundColor(colors.amber));
    text.on(Phaser.Input.Events.POINTER_OUT, () => text.setBackgroundColor(base));
    text.on(Phaser.Input.Events.POINTER_DOWN, run);
    return text;
  }

  private buildChipStrips(): void {
    const strips: readonly { readonly title: string; readonly items: readonly (readonly [string, () => void])[]; readonly accent: boolean }[] = [
      { title: "fx", items: this.fxActions(), accent: true },
      { title: "audio", items: AUDIO_CHIPS.map((chip) => [chip.label, () => emitGameEvent(this, chip.event)] as const), accent: false },
    ];
    const indent = 84;
    let y = GRID.top + 2 * (GRID.cellH + GRID.gap) + 2;
    for (const strip of strips) {
      this.add.text(24, y + 4, strip.title, { color: colors.parchmentDeep, fontFamily: fontStacks.mono, fontSize: `${typeScale.sm}px` }).setDepth(depth.hud);
      let x = indent;
      let rowHeight = 0;
      for (const [label, run] of strip.items) {
        const text = this.chip(x, y, label, run, strip.accent);
        rowHeight = Math.max(rowHeight, text.height);
        x += text.width + 8;
        if (x > this.scale.width - 110) {
          x = indent;
          y += text.height + 6;
        }
      }
      y += rowHeight + 8;
    }
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const actions = this.fxActions();
    const keys = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"] as const;
    keys.forEach((key, i) => {
      const action = actions[i];
      if (action) keyboard.on(`keydown-${key}`, action[1]);
    });
    keyboard.on("keydown-R", () => setReducedMotion(!isReducedMotion()));
  }

  private restartWith(spec: TransitionSpec): void {
    transitionToScene(this, "FxGalleryScene", { enter: spec } satisfies GalleryData, spec);
  }
}
