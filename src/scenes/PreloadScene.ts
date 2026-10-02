import Phaser from "phaser";
import { ASSET_MANIFEST, type AssetEntry } from "../data/assetManifest";
import { recordAssetFailure, recordFontFailures } from "../dev/devProbe";
import { readRequestedShowcase } from "../dev/showcaseStates";
import { PARTICLE_SHEETS, type ParticleSheetId } from "../fx/fxPresets";
import { particleTextureKey } from "../fx/fxTextures";
import { colorNumber, colors, fontStacks } from "../game/designTokens";
import { loadGameFonts, type FontLoadReport } from "../game/fonts";

export class PreloadScene extends Phaser.Scene {
  private readonly failedKeys = new Set<string>();
  private fontsReady: Promise<FontLoadReport> = Promise.resolve({ loaded: [], failed: [] });

  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const { width, height } = this.scale;
    this.fontsReady = loadGameFonts();

    this.add
      .text(width / 2, height / 2 - 28, "warming the gyoza engine...", {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: "16px",
      })
      .setOrigin(0.5);

    const barWidth = 280;
    this.add.rectangle(width / 2, height / 2 + 8, barWidth, 8, colorNumber(colors.inkSoft)).setOrigin(0.5);
    const bar = this.add
      .rectangle(width / 2 - barWidth / 2, height / 2 + 8, 0, 8, colorNumber(colors.ember))
      .setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = barWidth * value;
    });

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.failedKeys.add(file.key);
    });

    for (const entry of ASSET_MANIFEST) {
      this.queueAsset(entry);
    }
  }

  create(): void {
    for (const entry of ASSET_MANIFEST) {
      if (this.failedKeys.has(entry.key) || !this.textures.exists(entry.key)) {
        this.createFallbackTexture(entry);
        recordAssetFailure(entry.key);
      }
    }
    this.prewarmParticleTextures();

    void this.startFirstScene();
  }

  private async startFirstScene(): Promise<void> {
    const fonts = await this.fontsReady;
    recordFontFailures(fonts.failed);

    if (import.meta.env.DEV) {
      const showcase = readRequestedShowcase();
      if (showcase) {
        if (window.__CGE__) window.__CGE__.activeShowcase = showcase.id;
        this.scene.start(showcase.sceneKey, showcase.data?.());
        return;
      }
    }

    this.scene.start("TitleScene");
  }

  /**
   * Builds the warm-recoloured particle sheets once, behind the loading screen. Otherwise the
   * first scene that emits steam/dust/thrust pays for the canvas copy + getImageData (the
   * flight -> landing hand-off frame hitched by ~50-80 ms).
   */
  private prewarmParticleTextures(): void {
    for (const id of Object.keys(PARTICLE_SHEETS) as ParticleSheetId[]) {
      particleTextureKey(this, id);
    }
  }

  private queueAsset(entry: AssetEntry): void {
    switch (entry.kind) {
      case "image":
        this.load.image(entry.key, entry.path);
        return;
      case "spritesheet":
        this.load.spritesheet(entry.key, entry.path, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
          endFrame: entry.frameCount - 1,
        });
        return;
    }
  }

  /** Generates a same-size stand-in so scenes never crash on a missing texture. */
  private createFallbackTexture(entry: AssetEntry): void {
    if (this.textures.exists(entry.key)) this.textures.remove(entry.key);

    const texture = this.textures.createCanvas(entry.key, entry.width, entry.height);
    if (!texture) return;

    const context = texture.getContext();
    const frameWidth = entry.kind === "spritesheet" ? entry.frameWidth : entry.width;
    const frameHeight = entry.kind === "spritesheet" ? entry.frameHeight : entry.height;
    const frameCount = entry.kind === "spritesheet" ? entry.frameCount : 1;

    context.clearRect(0, 0, entry.width, entry.height);
    context.fillStyle = entry.fallback.color;
    context.globalAlpha = 0.85;

    for (let frame = 0; frame < frameCount; frame += 1) {
      const x = frame * frameWidth;
      if (entry.fallback.shape === "circle") {
        context.beginPath();
        context.ellipse(x + frameWidth / 2, frameHeight / 2, frameWidth * 0.45, frameHeight * 0.45, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(x, 0, frameWidth, frameHeight);
      }

      if (entry.kind === "spritesheet") {
        texture.add(frame, 0, x, 0, frameWidth, frameHeight);
      }
    }

    texture.refresh();
  }
}
