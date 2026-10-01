import Phaser from "phaser";
import { colorNumber, colors, motion } from "../game/designTokens";
import { isReducedMotion } from "../fx/feedback";
import { typewriterVisibleChars } from "./layout";
import { monoStyle } from "./textStyles";

export type DashboardTickerOptions = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly lines?: readonly string[];
  /** Reveal speed of the typewriter. */
  readonly charsPerSecond?: number;
  /** How long a fully revealed line stays before the next one (cycling only). */
  readonly holdMs?: number;
  readonly fixed?: boolean;
  /** Draw a dark HUD strip behind the line. */
  readonly background?: boolean;
};

export const TICKER_HEIGHT = 34;
const PROMPT = "›";
const PADDING_X = 12;

/**
 * Mono dashboard chatter line with a gentle typewriter reveal and a soft caret. Cycles through
 * `lines` or shows lines pushed with `say()`. Reduced motion reveals lines instantly.
 * Origin: top-left.
 */
export class DashboardTicker extends Phaser.GameObjects.Container {
  private readonly lineText: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private readonly charsPerSecond: number;
  private readonly holdMs: number;
  private lines: readonly string[];
  private lineIndex = 0;
  private current = "";
  private shownChars = -1;
  private elapsedMs = 0;
  private caretTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, options: DashboardTickerOptions) {
    super(scene, options.x, options.y);
    this.charsPerSecond = options.charsPerSecond ?? 34;
    this.holdMs = options.holdMs ?? 3600;
    this.lines = options.lines ?? [];

    if (options.background ?? true) {
      const g = scene.add.graphics();
      g.fillStyle(colorNumber(colors.cosmosPanel), 0.78);
      g.fillRoundedRect(0, 0, options.width, TICKER_HEIGHT, 6);
      g.lineStyle(2, colorNumber(colors.plaster), 0.12);
      g.strokeRoundedRect(1, 1, options.width - 2, TICKER_HEIGHT - 2, 5);
      this.add(g);
    }

    const prompt = scene.add
      .text(PADDING_X, TICKER_HEIGHT / 2, PROMPT, monoStyle({ size: 15, bold: true, color: colors.ember }))
      .setOrigin(0, 0.5);
    this.lineText = scene.add
      .text(PADDING_X + 16, TICKER_HEIGHT / 2, "", monoStyle({ size: 14, color: colors.plaster }))
      .setOrigin(0, 0.5)
      .setAlpha(0.88);
    this.caret = scene.add.rectangle(0, TICKER_HEIGHT / 2, 8, 14, colorNumber(colors.ember)).setOrigin(0, 0.5);
    this.add([prompt, this.lineText, this.caret]);
    this.setSize(options.width, TICKER_HEIGHT);
    if (options.fixed) this.setScrollFactor(0, 0, true);

    if (!isReducedMotion()) {
      this.caretTween = scene.tweens.add({
        targets: this.caret,
        alpha: { from: 1, to: 0.15 },
        duration: motion.breath / 4,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.caretTween?.remove();
    });

    const first = this.lines[0];
    if (first !== undefined) this.show(first);
    scene.add.existing(this);
  }

  /** Replaces the current line (and stops cycling until `setLines`). */
  say(line: string): this {
    this.lines = [];
    this.show(line);
    return this;
  }

  setLines(lines: readonly string[]): this {
    this.lines = lines;
    this.lineIndex = 0;
    const first = lines[0];
    if (first !== undefined) this.show(first);
    return this;
  }

  /** Reveals the whole current line immediately (screenshots, skip). */
  finishReveal(): this {
    this.elapsedMs = (this.current.length / this.charsPerSecond) * 1000;
    this.render(this.current.length);
    return this;
  }

  private show(line: string): void {
    this.current = line;
    this.elapsedMs = 0;
    this.shownChars = -1;
    this.render(isReducedMotion() ? line.length : 0);
  }

  private tick(_time: number, delta: number): void {
    if (!this.active || this.current.length === 0) return;
    this.elapsedMs += delta;
    const visible = isReducedMotion() ? this.current.length : typewriterVisibleChars(this.elapsedMs, this.charsPerSecond, this.current.length);
    this.render(visible);

    if (this.lines.length > 1) {
      const revealMs = (this.current.length / this.charsPerSecond) * 1000;
      if (this.elapsedMs >= revealMs + this.holdMs) {
        this.lineIndex = (this.lineIndex + 1) % this.lines.length;
        const next = this.lines[this.lineIndex];
        if (next !== undefined) this.show(next);
      }
    }
  }

  private render(visibleChars: number): void {
    if (visibleChars === this.shownChars) return;
    this.shownChars = visibleChars;
    this.lineText.setText(this.current.slice(0, visibleChars));
    this.caret.setX(this.lineText.x + this.lineText.width + 3);
  }
}
