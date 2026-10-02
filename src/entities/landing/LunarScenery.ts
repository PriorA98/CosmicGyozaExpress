import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { createSteam } from "../../fx/feedback";

export type LunarSceneryOptions = {
  readonly surfaceY: number;
  /** Touch layouts move the tea house inward so the right touch tiles never cover it. */
  readonly touchLayout: boolean;
};

/**
 * Static Tea Moon backdrop: painted sky (plus a dark high sky above it for the arrival pan), faint
 * twinkles, parallax hills, walkable ground, the tea house (with steam), and foreground rock clusters.
 * Backdrop layers overscan every canvas edge so camera shake never reveals the clear colour.
 */
export class LunarScenery {
  private readonly hills: Phaser.GameObjects.TileSprite;
  private readonly stopSteam: () => void;
  private readonly centerX: number;
  private readonly hillsBaseX: number;

  constructor(scene: Phaser.Scene, options: LunarSceneryOptions) {
    const { width, height } = scene.scale;
    const art = LANDING_ART_SCALE;
    const { surfaceY } = options;
    const sky = landingScenery.sky;
    const over = sky.overscanPx;
    const rise = landingScenery.intro.risePx;
    this.centerX = width / 2;

    // High sky (arrival pan) and shake overscan around the painted sky.
    scene.add
      .rectangle(-over, -rise - over, width + over * 2, height + rise + over * 2, colorNumber(sky.topColor))
      .setOrigin(0, 0)
      .setDepth(depth.backdrop);
    scene.add
      .rectangle(-over, height - over, width + over * 2, over * 3, colorNumber(sky.groundBelowColor))
      .setOrigin(0, 0)
      .setDepth(depth.world - 1);
    this.createHighStars(scene, width, rise);

    // The painted sky sits at the canvas origin and never wraps (its right edge carries a planet). The shake
    // overscan either side repeats the sky's own edge column, so a shaken frame shows more of the same sky.
    const skyFrame = scene.textures.getFrame(sky.key);
    const skyArtWidth = skyFrame?.width ?? width / art;
    const skyArtHeight = skyFrame?.height ?? height / art;
    const overArt = Math.ceil(over / art);
    scene.add.image(0, 0, sky.key).setOrigin(0, 0).setScale(art).setDepth(depth.backdrop);
    const edgeStretch = overArt * art;
    scene.add
      .image(-edgeStretch, 0, sky.key)
      .setOrigin(0, 0)
      .setCrop(0, 0, 1, skyArtHeight)
      .setScale(edgeStretch, art)
      .setDepth(depth.backdrop);
    scene.add
      .image(skyArtWidth * art - (skyArtWidth - 1) * edgeStretch, 0, sky.key)
      .setOrigin(0, 0)
      .setCrop(skyArtWidth - 1, 0, 1, skyArtHeight)
      .setScale(edgeStretch, art)
      .setDepth(depth.backdrop);

    this.createTwinkles(scene, width);

    const hillsConfig = landingScenery.hills;
    const hillsHeightArt = scene.textures.getFrame(hillsConfig.key)?.height ?? 96;
    const hillsTop = surfaceY + hillsConfig.overlapBelowSurfaceArtPx * art - hillsHeightArt * art;
    this.hillsBaseX = -overArt;
    this.hills = scene.add
      .tileSprite(-overArt * art, hillsTop, width / art + overArt * 2, hillsHeightArt, hillsConfig.key)
      .setOrigin(0, 0)
      .setScale(art)
      .setTilePosition(this.hillsBaseX, 0)
      .setAlpha(hillsConfig.alpha)
      .setDepth(depth.parallax);

    const groundConfig = landingScenery.ground;
    const groundHeightArt = scene.textures.getFrame(groundConfig.key)?.height ?? 64;
    scene.add
      .tileSprite(-overArt * art, surfaceY - groundConfig.surfaceRowArtPx * art, width / art + overArt * 2, groundHeightArt, groundConfig.key)
      .setOrigin(0, 0)
      .setScale(art)
      .setTilePosition(-overArt, 0)
      .setDepth(depth.world);

    const teahouse = landingScenery.teahouse;
    const houseX = options.touchLayout ? teahouse.touchX : teahouse.x;
    scene.add
      .image(houseX, surfaceY + teahouse.baseSinkPx, teahouse.key)
      .setOrigin(0.5, 1)
      .setScale(art)
      .setDepth(depth.world + 1);
    this.stopSteam = createSteam(scene, houseX + teahouse.steamOffsetX, surfaceY - teahouse.steamOffsetY, {
      depth: depth.world + 1,
    });

    for (const rock of landingScenery.rocks) {
      scene.add
        .image(rock.x, surfaceY + rock.offsetY, landingScenery.rocksKey, rock.frame)
        .setOrigin(0.5, 1)
        .setScale(art)
        .setFlipX(rock.flipX)
        .setAlpha(landingScenery.rockAlpha)
        .setDepth(depth.foreground);
    }
  }

  /** Slides the far hills a little opposite the ship's horizontal offset (whole art px only). */
  update(shipX: number): void {
    const offsetScreenPx = (shipX - this.centerX) * landingScenery.hills.parallax;
    this.hills.tilePositionX = this.hillsBaseX + Math.round(-offsetScreenPx / LANDING_ART_SCALE);
  }

  destroy(): void {
    this.stopSteam();
  }

  private createHighStars(scene: Phaser.Scene, width: number, rise: number): void {
    const config = landingScenery.sky.highStars;
    const tint = colorNumber(colors.plaster);
    for (let i = 0; i < config.count; i += 1) {
      const x = Phaser.Math.Between(0, width / config.sizePx) * config.sizePx;
      const y = -Phaser.Math.Between(config.sizePx, rise / config.sizePx) * config.sizePx;
      scene.add
        .rectangle(x, y, config.sizePx, config.sizePx, tint, Phaser.Math.FloatBetween(config.minAlpha, config.maxAlpha))
        .setOrigin(0, 0)
        .setDepth(depth.backdrop + 1);
    }
  }

  private createTwinkles(scene: Phaser.Scene, width: number): void {
    const config = landingScenery.twinkles;
    const tint = colorNumber(colors.plaster);

    for (let i = 0; i < config.count; i += 1) {
      // Twinkles under the HUD read as stray glyphs in the readout rows: slide those out to the right.
      let x = Phaser.Math.Between(config.marginX, width - config.marginX) & ~1;
      const y = Phaser.Math.Between(config.marginX, config.maxY) & ~1;
      if (y < config.hudClearBottom && x < config.hudClearRight) {
        x = Phaser.Math.Between(config.hudClearRight, Math.max(config.hudClearRight, width - config.marginX)) & ~1;
      }
      const star = scene.add
        .rectangle(
          x,
          y,
          config.sizePx,
          config.sizePx,
          tint,
          config.minAlpha,
        )
        .setOrigin(0, 0)
        .setDepth(depth.backdrop + 1);

      scene.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(config.minAlpha + 0.08, config.maxAlpha),
        duration: Phaser.Math.Between(config.minPeriodMs, config.maxPeriodMs) / 2,
        delay: Phaser.Math.Between(0, config.maxPeriodMs),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
}
