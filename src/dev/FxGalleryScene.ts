import Phaser from "phaser";
import { ASSET } from "../data/assetManifest";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../game/designTokens";
import { emitGameEvent, type GameEvent } from "../game/events";
import {
  burstDust,
  burstIncident,
  burstSparkles,
  burstStars,
  createSteam,
  createThrustTrail,
  flashScreen,
  isReducedMotion,
  liveParticleCount,
  setReducedMotion,
  shakeCamera,
  squash,
  type ThrustTrail,
} from "../fx/feedback";
import { playEnterTransition, transitionToScene, type TransitionSpec } from "../fx/transitions";
import { registerDevState } from "./devProbe";

/**
 * Dev-only gallery of the src/fx effects and audio cues (owner: audio-fx package). Opened with
 * `?showcase=fx-gallery`. Never registered in production builds.
 *
 * Every particle effect loops in its own cell so one screenshot shows them all mid-flight.
 * Keys: 1 flash · 2 soft shake · 3 strong shake · 4 iris · 5 warm fade · 6 warp · R reduced motion.
 * The chips along the bottom emit real GameEvents, so the AudioSystem plays the mapped cue.
 */

type GalleryData = { readonly enter?: TransitionSpec };

type Cell = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly cx: number; readonly cy: number };

const GRID = { cols: 4, rows: 2, cellW: 296, cellH: 236, gap: 16, top: 70 } as const;
const SHIP_SCALE = 0.65;
const SHIP_NOZZLE_OFFSET = 38;
const ORBIT = { radius: 62, periodMs: 3600 } as const;
const BURST_LOOPS = [
  { cell: 2, everyMs: 900, label: "dust" },
  { cell: 3, everyMs: 1000, label: "sparkle" },
  { cell: 4, everyMs: 1500, label: "incident" },
  { cell: 5, everyMs: 1200, label: "stars" },
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

export class FxGalleryScene extends Phaser.Scene {
  private readonly cells: Cell[] = [];
  private readonly trails: ThrustTrail[] = [];
  private readonly stopSteam: (() => void)[] = [];
  private orbitShip: Phaser.GameObjects.Image | null = null;
  private hoverShip: Phaser.GameObjects.Image | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
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

    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmosDeep)).setOrigin(0, 0).setDepth(depth.backdrop);
    this.add
      .text(24, 26, "fx gallery", { color: colors.parchment, fontFamily: fontStacks.display, fontSize: `${typeScale.xl}px` })
      .setOrigin(0, 0.5);
    this.add
      .text(width - 24, 26, "1 flash · 2/3 shake · 4 iris · 5 fade · 6 warp · R reduced motion", {
        color: colors.duskBlue,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
      })
      .setOrigin(1, 0.5);

    this.layoutCells();
    this.buildThrustCells();
    this.buildSteamCell();
    this.buildFlashCell();
    this.buildAudioStrip();
    this.bindKeys();

    this.statusText = this.add
      .text(24, height - 14, "", { color: colors.borderStrong, fontFamily: fontStacks.mono, fontSize: `${typeScale.xs}px` })
      .setOrigin(0, 1);

    // First bursts fire immediately and staggered so a single capture shows each effect mid-flight.
    for (const loop of BURST_LOOPS) this.burstClock.set(loop.cell, loop.everyMs * 0.55);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const trail of this.trails) trail.destroy();
      for (const stop of this.stopSteam) stop();
    });

    registerDevState("fx", () => ({ liveParticles: liveParticleCount(this), reducedMotion: isReducedMotion() }));
    emitGameEvent(this, { type: "scene:enter", scene: "FxGalleryScene" });
    if (data.enter) void playEnterTransition(this, data.enter);
  }

  update(_time: number, delta: number): void {
    this.elapsedMs += delta;
    this.updateThrust();

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
    const labels = ["thrust · cruise orbit", "thrust · landing hover", "dust puff", "sparkles", "gyoza incident", "star twinkle", "steam", "flash · shake · transitions"];
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        const x = left + col * (GRID.cellW + GRID.gap);
        const y = GRID.top + row * (GRID.cellH + GRID.gap);
        const cell: Cell = { x, y, w: GRID.cellW, h: GRID.cellH, cx: x + GRID.cellW / 2, cy: y + GRID.cellH / 2 + 10 };
        this.cells.push(cell);
        this.add
          .rectangle(x, y, GRID.cellW, GRID.cellH, colorNumber(colors.cosmosPanel))
          .setOrigin(0, 0)
          .setStrokeStyle(2, colorNumber(colors.inkSoft))
          .setDepth(depth.backdrop);
        this.add
          .text(x + 12, y + 12, labels[row * GRID.cols + col] ?? "", {
            color: colors.parchmentDeep,
            fontFamily: fontStacks.mono,
            fontSize: `${typeScale.sm}px`,
          })
          .setDepth(depth.hud);
      }
    }
  }

  private cell(index: number): Cell {
    const cell = this.cells[index];
    if (!cell) throw new Error(`fx gallery cell ${index} missing`);
    return cell;
  }

  private buildThrustCells(): void {
    const orbit = this.cell(0);
    this.orbitShip = this.add.image(orbit.cx, orbit.cy, ASSET.shipFly2).setScale(SHIP_SCALE * 0.7).setDepth(depth.ship);
    this.trails.push(createThrustTrail(this, { offset: SHIP_NOZZLE_OFFSET * 0.7 }));

    const hover = this.cell(1);
    this.hoverShip = this.add.image(hover.cx, hover.cy - 40, ASSET.shipFly1).setScale(SHIP_SCALE).setDepth(depth.ship);
    this.trails.push(createThrustTrail(this, { offset: SHIP_NOZZLE_OFFSET }));
    this.add.rectangle(hover.cx, hover.y + hover.h - 26, 150, 6, colorNumber(colors.sageDeep)).setDepth(depth.world);
  }

  private updateThrust(): void {
    const [orbitTrail, hoverTrail] = this.trails;
    if (this.orbitShip && orbitTrail) {
      const orbit = this.cell(0);
      const phase = (this.elapsedMs / ORBIT.periodMs) * Math.PI * 2;
      const x = orbit.cx + Math.cos(phase) * ORBIT.radius * 1.3;
      const y = orbit.cy + Math.sin(phase) * ORBIT.radius * 0.8;
      // Nose follows the orbit tangent (ship convention: 0 = up, clockwise).
      const rotation = Math.atan2(Math.cos(phase) * 0.8, -Math.sin(phase) * 1.3) ;
      this.orbitShip.setPosition(x, y).setRotation(rotation);
      orbitTrail.update(x, y, rotation, true, 0.6 + 0.4 * Math.sin(phase * 2));
    }
    if (this.hoverShip && hoverTrail) {
      const hover = this.cell(1);
      const sway = Math.sin(this.elapsedMs / 700) * 0.12;
      const bob = Math.sin(this.elapsedMs / 450) * 4;
      const firing = Math.floor(this.elapsedMs / 1400) % 3 !== 2;
      const y = hover.cy - 40 + bob;
      this.hoverShip.setPosition(hover.cx, y).setRotation(sway).setTexture(firing ? ASSET.shipFly1 : ASSET.shipIdle);
      hoverTrail.update(hover.cx, y, sway, firing, 1);
    }
  }

  private fireBurst(index: number): void {
    const cell = this.cell(index);
    switch (index) {
      case 2:
        burstDust(this, cell.cx, cell.cy + 30, { spread: 70 });
        return;
      case 3:
        burstSparkles(this, cell.cx, cell.cy + 20);
        return;
      case 4:
        burstIncident(this, cell.cx, cell.cy + 10);
        return;
      case 5:
        burstStars(this, cell.cx, cell.cy, { spread: 60 });
        return;
    }
  }

  private buildSteamCell(): void {
    const cell = this.cell(6);
    const cups = [-70, 0, 70];
    for (const dx of cups) {
      const cup = this.add.image(cell.cx + dx, cell.cy + 50, ASSET.itemTea).setScale(2).setDepth(depth.world);
      this.stopSteam.push(createSteam(this, cup.x, cup.y - cup.displayHeight / 2 - 4));
    }
  }

  private buildFlashCell(): void {
    const cell = this.cell(7);
    const rows: readonly (readonly [string, () => void])[] = [
      ["flash (1)", () => flashScreen(this)],
      ["shake soft (2)", () => shakeCamera(this, "soft")],
      ["shake strong (3)", () => shakeCamera(this, "strong")],
      ["iris (4)", () => this.restartWith({ kind: "iris", x: cell.cx, y: cell.cy })],
      ["warm fade (5)", () => this.restartWith({ kind: "warm-fade" })],
      ["warp (6)", () => this.restartWith({ kind: "warp" })],
    ];
    rows.forEach(([label, run], i) => {
      const chip = this.add
        .text(cell.x + 20, cell.y + 46 + i * 28, `▸ ${label}`, {
          color: colors.parchment,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.sm}px`,
        })
        .setDepth(depth.hud)
        .setInteractive({ useHandCursor: true });
      chip.on(Phaser.Input.Events.POINTER_OVER, () => chip.setColor(colors.amber));
      chip.on(Phaser.Input.Events.POINTER_OUT, () => chip.setColor(colors.parchment));
      chip.on(Phaser.Input.Events.POINTER_DOWN, run);
    });
    const plate = this.add.rectangle(cell.x + cell.w - 64, cell.cy + 30, 72, 72, colorNumber(colors.terracotta)).setDepth(depth.world);
    plate.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_DOWN, () => squash(this, plate, 0.18));
    this.add
      .text(plate.x, plate.y + 50, "squash", { color: colors.borderStrong, fontFamily: fontStacks.mono, fontSize: `${typeScale.xs}px` })
      .setOrigin(0.5)
      .setDepth(depth.hud);
  }

  private buildAudioStrip(): void {
    const top = GRID.top + GRID.rows * (GRID.cellH + GRID.gap) + 6;
    this.add.text(24, top, "audio cues (click)", { color: colors.parchmentDeep, fontFamily: fontStacks.mono, fontSize: `${typeScale.sm}px` });
    let x = 24;
    let y = top + 26;
    for (const chip of AUDIO_CHIPS) {
      const text = this.add
        .text(x, y, chip.label, {
          color: colors.ink,
          backgroundColor: colors.parchment,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.sm}px`,
          padding: { x: 8, y: 4 },
        })
        .setDepth(depth.hud)
        .setInteractive({ useHandCursor: true });
      text.on(Phaser.Input.Events.POINTER_OVER, () => text.setBackgroundColor(colors.amber));
      text.on(Phaser.Input.Events.POINTER_OUT, () => text.setBackgroundColor(colors.parchment));
      text.on(Phaser.Input.Events.POINTER_DOWN, () => emitGameEvent(this, chip.event));
      x += text.width + 8;
      if (x > this.scale.width - 120) {
        x = 24;
        y += text.height + 8;
      }
    }
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on("keydown-ONE", () => flashScreen(this));
    keyboard.on("keydown-TWO", () => shakeCamera(this, "soft"));
    keyboard.on("keydown-THREE", () => shakeCamera(this, "strong"));
    keyboard.on("keydown-FOUR", () => this.restartWith({ kind: "iris", x: this.cell(7).cx, y: this.cell(7).cy }));
    keyboard.on("keydown-FIVE", () => this.restartWith({ kind: "warm-fade" }));
    keyboard.on("keydown-SIX", () => this.restartWith({ kind: "warp" }));
    keyboard.on("keydown-R", () => setReducedMotion(!isReducedMotion()));
  }

  private restartWith(spec: TransitionSpec): void {
    transitionToScene(this, "FxGalleryScene", { enter: spec } satisfies GalleryData, spec);
  }
}
