import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { createSteam } from "../../fx/feedback";

/**
 * Static Tea Moon backdrop: painted sky, faint twinkles, parallax hills, walkable ground,
 * the tea house (with steam), and foreground rock clusters. Only the hills move (parallax).
 */
export class LunarScenery {
  private readonly hills: Phaser.GameObjects.TileSprite;
  private readonly stopSteam: () => void;
  private readonly centerX: number;

  constructor(scene: Phaser.Scene, surfaceY: number) {
    const { width, height } = scene.scale;
    const art = LANDING_ART_SCALE;
    this.centerX = width / 2;

    scene.add
      .image(0, 0, landingScenery.sky.key)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
      .setDepth(depth.backdrop);

    this.createTwinkles(scene, width);

    const hillsConfig = landingScenery.hills;
    const hillsHeightArt = scene.textures.getFrame(hillsConfig.key)?.height ?? 96;
    const hillsTop = surfaceY + hillsConfig.overlapBelowSurfaceArtPx * art - hillsHeightArt * art;
    this.hills = scene.add
      .tileSprite(0, hillsTop, width / art, hillsHeightArt, hillsConfig.key)
      .setOrigin(0, 0)
      .setScale(art)
      .setAlpha(hillsConfig.alpha)
      .setDepth(depth.parallax);

    const groundConfig = landingScenery.ground;
    const groundHeightArt = scene.textures.getFrame(groundConfig.key)?.height ?? 64;
    scene.add
      .tileSprite(0, surfaceY - groundConfig.surfaceRowArtPx * art, width / art, groundHeightArt, groundConfig.key)
      .setOrigin(0, 0)
      .setScale(art)
      .setDepth(depth.world);

    const teahouse = landingScenery.teahouse;
    scene.add
      .image(teahouse.x, surfaceY + teahouse.baseSinkPx, teahouse.key)
      .setOrigin(0.5, 1)
      .setScale(art)
      .setDepth(depth.world + 1);
    this.stopSteam = createSteam(scene, teahouse.x + teahouse.steamOffsetX, surfaceY - teahouse.steamOffsetY, {
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

  /** Slides the far hills a little opposite the ship's horizontal offset. */
  update(shipX: number): void {
    const offsetScreenPx = (shipX - this.centerX) * landingScenery.hills.parallax;
    this.hills.tilePositionX = Math.round(-offsetScreenPx / LANDING_ART_SCALE);
  }

  destroy(): void {
    this.stopSteam();
  }

  private createTwinkles(scene: Phaser.Scene, width: number): void {
    const config = landingScenery.twinkles;
    const tint = colorNumber(colors.plaster);

    for (let i = 0; i < config.count; i += 1) {
      const star = scene.add
        .rectangle(
          Phaser.Math.Between(config.marginX, width - config.marginX),
          Phaser.Math.Between(config.marginX, config.maxY),
          config.sizePx,
          config.sizePx,
          tint,
          config.minAlpha,
        )
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
