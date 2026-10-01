import Phaser from "phaser";
import { ASSET, RABBIT_PORTRAIT_FRAME } from "../data/assetManifest";
import { TEA_MOON_MISSION_ID, teaMoonMission } from "../data/missions";
import { titleCopy } from "../data/uiCopy";
import { createDevSceneLauncherPanel, installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { createThrustTrail, isReducedMotion, type ThrustTrail } from "../fx/feedback";
import { colorNumber, colors, depth, motion, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { SaveSystem } from "../systems/SaveSystem";
import type { FlightSceneData } from "../types/flight";
import { Button } from "../ui/Button";
import { addUiIcon } from "../ui/icons";
import { Keycap, KEYCAP_HEIGHT } from "../ui/Keycap";
import { ParchmentCard } from "../ui/ParchmentCard";
import { StatePill } from "../ui/StatePill";
import { drawRecessedSurface, UI_ART_SCALE } from "../ui/surfaces";
import { bodyStyle, bodyStrongStyle, displayTitleStyle, headingStyle, monoStyle } from "../ui/textStyles";
import { hasAuthoredTexture } from "../ui/uiTextures";

/** Title composition on the 1280x720 logical canvas (screen px). */
const LAYOUT = {
  marginX: 96,
  logoTopY: 84,
  logoSize: 96,
  logoLineGap: 92,
  logoShadow: { x: 5, y: 6 },
  subtitleY: 292,
  buttonY: 340,
  buttonWidth: 392,
  buttonHeight: 60,
  hintsY: 436,
  ship: { x: 624, y: 468, scale: 1, rotation: 0.16, bobPx: 9, swayRad: 0.035, thrustOffset: 50 },
  moon: { x: 1030, y: 214 },
  farPlanet: { x: 512, y: 728 },
  card: { x: 760, y: 420, width: 456, height: 268 },
  devPanelX: 18,
} as const;

/**
 * Idle thrust puffs: the burner only breathes while the ship sinks through the low half of its
 * bob, like a little hop to hold altitude. `sinkThreshold` is sin(phase) above which it fires.
 */
const PUFFS = { sinkThreshold: 0.45, baseIntensity: 0.12, peakIntensity: 0.22 } as const;

/** Stepped glow behind the tea moon (screen px; moon art is 192 art px at scale 2). */
const MOON_GLOW = { rings: 6, innerRadius: 200, step: 18, alpha: 0.035 } as const;

/** Slow parallax drift for backdrop layers (texture px per second). */
const DRIFT = { far: 3, nebula: 1.2, near: 7 } as const;

type Layer = Phaser.GameObjects.TileSprite;

export class TitleScene extends Phaser.Scene {
  private starsFar: Layer | undefined;
  private nebula: Layer | undefined;
  private starsNear: Layer | undefined;
  private ship: Phaser.GameObjects.Sprite | undefined;
  private trail: ThrustTrail | undefined;
  private startButton: Button | undefined;
  private teaMoonDelivered = false;
  private starting = false;
  private elapsedMs = 0;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.starting = false;
    this.elapsedMs = 0;
    this.teaMoonDelivered = readTeaMoonDelivered();

    this.createBackdrop();
    this.createCelestials();
    this.createShip();
    this.createLogo();
    this.createActions();
    this.createMissionCard();

    installDevSceneHotkeys(this);
    createDevSceneLauncherPanel(this, { x: LAYOUT.devPanelX });

    registerDevState("title", () => ({
      teaMoonDelivered: this.teaMoonDelivered,
      buttonFocused: this.startButton?.isFocused ?? false,
    }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.trail?.destroy();
      this.trail = undefined;
    });

    const fade = Phaser.Display.Color.HexStringToColor(colors.cosmosDeep);
    this.cameras.main.fadeIn(motion.slow, fade.red, fade.green, fade.blue);
    emitGameEvent(this, { type: "scene:enter", scene: "TitleScene" });
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta, 100) / 1000;
    this.elapsedMs += delta;
    if (this.starsFar) this.starsFar.tilePositionX += DRIFT.far * seconds;
    if (this.nebula) this.nebula.tilePositionX += DRIFT.nebula * seconds;
    if (this.starsNear) this.starsNear.tilePositionX += DRIFT.near * seconds;

    const ship = this.ship;
    if (!ship) return;
    const calm = isReducedMotion() ? 0.25 : 1;
    const phase = (this.elapsedMs / motion.breath) * Math.PI * 2;
    ship.y = LAYOUT.ship.y + Math.sin(phase) * LAYOUT.ship.bobPx * calm;
    ship.rotation = LAYOUT.ship.rotation + Math.sin(phase * 0.5) * LAYOUT.ship.swayRad * calm;
    // Soft puffs: the burner breathes with the bob so the ship looks like it is gently holding altitude.
    const sink = Math.sin(phase);
    const puffing = sink > PUFFS.sinkThreshold;
    const intensity = PUFFS.baseIntensity + (PUFFS.peakIntensity - PUFFS.baseIntensity) * Math.max(0, sink);
    this.trail?.update(ship.x, ship.y, ship.rotation, puffing, intensity);
  }

  private createBackdrop(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0).setDepth(depth.backdrop);

    this.starsFar = this.addLayer(ASSET.spaceStarsFar, "title-stars-far", 0.9);
    this.nebula = hasAuthoredTexture(this, ASSET.spaceNebula) ? this.addTiled(ASSET.spaceNebula, 0.85) : undefined;
    if (!this.nebula) this.drawNebulaWash();
    this.starsNear = this.addLayer(ASSET.spaceStarsNear, "title-stars-near", 1);

    // Warm vignette pools so the corners settle and the UI columns read clearly.
    const glow = this.add.graphics().setDepth(depth.parallax);
    glow.fillStyle(colorNumber(colors.cosmosDeep), 0.35);
    glow.fillRect(0, 0, 520, height);
    glow.fillStyle(colorNumber(colors.cosmosDeep), 0.18);
    glow.fillRect(520, 0, 120, height);
  }

  private addLayer(key: string, fallbackKey: string, alpha: number): Layer {
    if (hasAuthoredTexture(this, key)) return this.addTiled(key, alpha);
    return this.addTiled(ensureStarfieldTexture(this, fallbackKey, fallbackKey.endsWith("near") ? 14 : 40), alpha);
  }

  private addTiled(key: string, alpha: number): Layer {
    const { width, height } = this.scale;
    return this.add
      .tileSprite(0, 0, width, height, key)
      .setOrigin(0, 0)
      .setTileScale(UI_ART_SCALE)
      .setAlpha(alpha)
      .setDepth(depth.backdrop);
  }

  /** Drawn stand-in for the nebula art: a few stepped plum/teal pools. */
  private drawNebulaWash(): void {
    const g = this.add.graphics().setDepth(depth.backdrop);
    const pools: readonly { x: number; y: number; r: number; color: string }[] = [
      { x: 980, y: 180, r: 360, color: colors.plum },
      { x: 360, y: 620, r: 320, color: colors.teal },
      { x: 760, y: 420, r: 220, color: colors.terracotta },
    ];
    for (const pool of pools) {
      for (let step = 0; step < 4; step += 1) {
        g.fillStyle(colorNumber(pool.color), 0.035);
        g.fillCircle(pool.x, pool.y, pool.r * (1 - step * 0.2));
      }
    }
  }

  private createCelestials(): void {
    const plum = this.add.image(LAYOUT.farPlanet.x, LAYOUT.farPlanet.y, ASSET.planetFarPlum).setScale(UI_ART_SCALE).setDepth(depth.parallax);
    plum.setAlpha(0.9);

    const halo = this.add.graphics().setDepth(depth.parallax);
    halo.setPosition(LAYOUT.moon.x, LAYOUT.moon.y);
    // Moonlight: stacked translucent discs read as a stepped pixel glow, warm at the rim.
    for (let ring = 0; ring < MOON_GLOW.rings; ring += 1) {
      halo.fillStyle(colorNumber(ring < 2 ? colors.amber : colors.parchmentDeep), MOON_GLOW.alpha);
      halo.fillCircle(0, 0, MOON_GLOW.innerRadius + ring * MOON_GLOW.step);
    }
    if (!isReducedMotion()) {
      this.tweens.add({ targets: halo, scale: { from: 0.97, to: 1.03 }, alpha: { from: 0.75, to: 1 }, duration: motion.breath * 1.5, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.add.image(LAYOUT.moon.x, LAYOUT.moon.y, ASSET.celestialTeaMoon).setScale(UI_ART_SCALE).setDepth(depth.world);

    this.addTwinkles();
  }

  /** Little plus-shaped pixel sparkles that twinkle out of phase. */
  private addTwinkles(): void {
    const spots: readonly { x: number; y: number; size: number; color: string }[] = [
      { x: 812, y: 96, size: 2, color: colors.amber },
      { x: 742, y: 262, size: 2, color: colors.plaster },
      { x: 1214, y: 392, size: 2, color: colors.amber },
      { x: 520, y: 60, size: 2, color: colors.plaster },
      { x: 860, y: 352, size: 1, color: colors.plaster },
      { x: 1180, y: 46, size: 1, color: colors.ember },
    ];
    spots.forEach((spot, index) => {
      const g = this.add.graphics().setDepth(depth.parallax).setPosition(spot.x, spot.y);
      const unit = 2 * spot.size;
      g.fillStyle(colorNumber(spot.color), 1);
      g.fillRect(-unit / 2, -unit * 2.5, unit, unit * 5);
      g.fillRect(-unit * 2.5, -unit / 2, unit * 5, unit);
      g.fillStyle(colorNumber(colors.plaster), 1);
      g.fillRect(-unit / 2, -unit / 2, unit, unit);
      if (isReducedMotion()) return;
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.15 },
        duration: motion.breath * (0.6 + (index % 3) * 0.25),
        delay: index * 320,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  private createShip(): void {
    const cruiseKey = "title-ship-cruise";
    if (!this.anims.exists(cruiseKey)) {
      this.anims.create({
        key: cruiseKey,
        frames: [{ key: ASSET.shipFly1 }, { key: ASSET.shipFly2 }, { key: ASSET.shipFly3 }, { key: ASSET.shipFly2 }],
        frameRate: 7,
        repeat: -1,
      });
    }
    this.ship = this.add
      .sprite(LAYOUT.ship.x, LAYOUT.ship.y, ASSET.shipFly1)
      .setScale(LAYOUT.ship.scale)
      .setRotation(LAYOUT.ship.rotation)
      .setDepth(depth.ship);
    this.ship.play(cruiseKey);
    this.trail = createThrustTrail(this, { depth: depth.ship - 1, offset: LAYOUT.ship.thrustOffset });
  }

  private createLogo(): void {
    const x = LAYOUT.marginX;
    const shadow = LAYOUT.logoShadow;
    const top = this.add.text(x, LAYOUT.logoTopY, titleCopy.logoTop, displayTitleStyle({ size: LAYOUT.logoSize, color: colors.plaster }));
    top.setShadow(shadow.x, shadow.y, colors.terracottaDeep, 0, false, true).setDepth(depth.hud);
    const bottom = this.add.text(x, LAYOUT.logoTopY + LAYOUT.logoLineGap, titleCopy.logoBottom, displayTitleStyle({ size: LAYOUT.logoSize, color: colors.ember }));
    bottom.setShadow(shadow.x, shadow.y, colors.ink, 0, false, true).setDepth(depth.hud);

    this.add
      .text(x + 4, LAYOUT.subtitleY, titleCopy.subtitle, bodyStrongStyle({ size: typeScale.lg, color: colors.parchmentDeep }))
      .setAlpha(0.88)
      .setDepth(depth.hud);
  }

  private createActions(): void {
    this.startButton = new Button(this, {
      x: LAYOUT.marginX,
      y: LAYOUT.buttonY,
      label: titleCopy.startButton,
      width: LAYOUT.buttonWidth,
      height: LAYOUT.buttonHeight,
      icon: "tea",
      keys: ["ENTER", "SPACE"],
      onActivate: () => this.startMission(),
    });
    this.startButton.setDepth(depth.hud).setFocused(true);

    let cursor: number = LAYOUT.marginX;
    for (const hint of titleCopy.hints) {
      const keycap = new Keycap(this, { x: cursor, y: LAYOUT.hintsY, label: hint.key }).setDepth(depth.hud);
      const label = this.add
        .text(cursor + keycap.keyWidth + 8, LAYOUT.hintsY + KEYCAP_HEIGHT / 2 - 1, hint.label, bodyStyle({ size: typeScale.base, color: colors.parchmentDeep }))
        .setOrigin(0, 0.5)
        .setAlpha(0.8)
        .setDepth(depth.hud);
      cursor = Math.ceil(label.x + label.width + 24);
    }
  }

  private createMissionCard(): void {
    const spec = LAYOUT.card;
    const card = new ParchmentCard(this, { x: spec.x, y: spec.y, width: spec.width, height: spec.height, title: titleCopy.missionHeader });
    card.setDepth(depth.hud);
    const pad = card.padding;

    // Route meta, right-aligned in the header.
    card.addContent(
      this.add
        .text(spec.width - pad, 22, teaMoonMission.title.toLowerCase(), monoStyle({ size: typeScale.sm, color: colors.sageDeep, bold: true }))
        .setOrigin(1, 0.5),
    );

    // Portrait in a recessed frame.
    const frameSize = 136;
    const frameY = card.contentTop;
    const frame = this.add.graphics();
    drawRecessedSurface(frame, pad, frameY, frameSize, frameSize);
    card.addContent(frame);
    card.addContent(...this.createPortrait(pad + frameSize / 2, frameY + frameSize / 2));

    const pill = new StatePill(this, {
      x: pad,
      y: frameY + frameSize + 12,
      state: this.teaMoonDelivered ? "idle" : "docking",
      label: this.teaMoonDelivered ? "delivered" : "awaiting tea",
    });
    card.addContent(pill);

    // Request copy column.
    const columnX = pad + frameSize + 18;
    const columnWidth = spec.width - columnX - pad;
    const name = this.add.text(columnX, frameY - 2, teaMoonMission.recipientName, headingStyle({ size: 22, color: colors.ink }));
    const request = this.add.text(columnX, frameY + 32, `“${teaMoonMission.requestText}”`, bodyStyle({ size: 15, color: colors.inkSoft, wrapWidth: columnWidth }));
    card.addContent(name, request);

    const itemsY = spec.height - pad - 64;
    card.addContent(...this.createItems(columnX, itemsY, columnWidth));

    if (this.teaMoonDelivered) this.addDeliveredStamp(card);
  }

  private createPortrait(x: number, y: number): Phaser.GameObjects.GameObject[] {
    if (!hasAuthoredTexture(this, ASSET.rabbitPortrait)) {
      // Monogram portrait (design-system NPC portrait pattern) until the rabbit art lands.
      const g = this.add.graphics();
      g.fillStyle(colorNumber(colors.plum), 1);
      g.fillRect(x - 60, y - 60, 120, 120);
      g.fillStyle(colorNumber(colors.ember), 1);
      g.fillCircle(x + 44, y + 44, 8);
      const letter = this.add.text(x, y - 4, "r", headingStyle({ size: 64, color: colors.plaster })).setOrigin(0.5, 0.5);
      return [g, letter];
    }

    const portrait = this.add
      .sprite(x, y, ASSET.rabbitPortrait, this.teaMoonDelivered ? RABBIT_PORTRAIT_FRAME.happy : RABBIT_PORTRAIT_FRAME.idle)
      .setScale(UI_ART_SCALE);
    if (!this.teaMoonDelivered && !isReducedMotion()) {
      this.time.addEvent({
        delay: motion.breath * 1.6,
        loop: true,
        callback: () => {
          portrait.setFrame(RABBIT_PORTRAIT_FRAME.blink);
          this.time.delayedCall(motion.fast + 40, () => portrait.setFrame(RABBIT_PORTRAIT_FRAME.idle));
        },
      });
    }
    return [portrait];
  }

  private createItems(x: number, y: number, width: number): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const tray = this.add.graphics();
    drawRecessedSurface(tray, x, y, width, 64);
    objects.push(tray);

    const slot = 64;
    const itemArt: readonly { key: string; icon: "tea" | "package" }[] = [
      { key: ASSET.itemTea, icon: "tea" },
      { key: ASSET.itemMochi, icon: "package" },
    ];
    itemArt.forEach((item, index) => {
      const cx = x + slot / 2 + index * (slot - 4);
      const cy = y + slot / 2;
      objects.push(
        hasAuthoredTexture(this, item.key)
          ? this.add.image(cx, cy, item.key).setScale(UI_ART_SCALE)
          : addUiIcon(this, cx, cy, item.icon),
      );
    });

    const labelX = x + slot * 2 + 4;
    objects.push(
      this.add
        .text(labelX, y + slot / 2, teaMoonMission.deliveryItemName, monoStyle({ size: typeScale.sm, bold: true, color: colors.inkSoft, wrapWidth: width - (labelX - x) - 10 }))
        .setOrigin(0, 0.5),
    );
    return objects;
  }

  private addDeliveredStamp(card: ParchmentCard): void {
    const stamp = this.add.container(card.cardWidth - 18, -16);
    const text = this.add.text(0, 0, titleCopy.deliveredBadge, monoStyle({ size: typeScale.sm, bold: true, color: colors.ink })).setOrigin(1, 0.5);
    const icon = addUiIcon(this, 0, 0, "memory");
    const widthPx = Math.ceil(text.width + 32 + 8 + 28);
    const height = 34;
    const g = this.add.graphics();
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(-widthPx + 3, -height / 2 + 3, widthPx, height);
    g.fillRect(-widthPx, -height / 2, widthPx, height);
    g.fillStyle(colorNumber("#C2CFAE"), 1);
    g.fillRect(-widthPx + 2, -height / 2 + 2, widthPx - 4, height - 4);
    text.setPosition(-14, 0);
    icon.setPosition(-widthPx + 14 + 16, 0);
    stamp.add([g, icon, text]).setRotation(-0.035);
    card.addContent(stamp);
  }

  private startMission(): void {
    if (this.starting) return;
    this.starting = true;
    this.startButton?.setEnabled(false).showState("pressed");
    const data: FlightSceneData = { missionId: TEA_MOON_MISSION_ID };
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("FlightScene", data));
    const fade = Phaser.Display.Color.HexStringToColor(colors.cosmosDeep);
    this.cameras.main.fadeOut(motion.slow, fade.red, fade.green, fade.blue);
  }
}

function readTeaMoonDelivered(): boolean {
  try {
    const save = SaveSystem.load();
    return Array.isArray(save.completedMissions) && save.completedMissions.includes(TEA_MOON_MISSION_ID);
  } catch {
    // Storage may be unavailable or the save unreadable; the title still works without it.
    return false;
  }
}

/** Seeded-by-harness pixel starfield used while the authored star layers are missing. */
function ensureStarfieldTexture(scene: Phaser.Scene, key: string, count: number): string {
  if (scene.textures.exists(key)) return key;
  const size = 256;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return key;
  const context = texture.getContext();
  const palette = [colors.plaster, colors.plaster, colors.duskBlue, colors.amber, colors.plum];
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    context.globalAlpha = 0.35 + Math.random() * 0.65;
    context.fillStyle = palette[index % palette.length] ?? colors.plaster;
    context.fillRect(x, y, 1, 1);
    if (index % 9 === 0) {
      context.globalAlpha *= 0.5;
      context.fillRect(x - 1, y, 3, 1);
      context.fillRect(x, y - 1, 1, 3);
    }
  }
  texture.refresh();
  return key;
}
