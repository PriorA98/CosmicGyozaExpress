import Phaser from "phaser";
import { colorNumber, colors, motion } from "../game/designTokens";
import { isReducedMotion } from "../fx/feedback";
import { TICKER_METRICS, monoCharsThatFit, typewriterVisibleChars, wrapMonoLines } from "./layout";
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
  /**
   * 1 (default): one line, longer chatter ends in an ellipsis. 2: long chatter wraps onto a second
   * line so punchlines survive; the strip is `dashboardTickerHeight(2)` tall either way.
   */
  readonly maxLines?: TickerLines;
};

export type TickerLines = 1 | 2;

/** One-line strip height (use `dashboardTickerHeight` / `tickerHeight` for wrapped tickers). */
export const TICKER_HEIGHT = 34;
/** Extra height per additional wrapped line. */
export const TICKER_LINE_HEIGHT = 18;

/** Strip height for a ticker that may wrap to `lines` lines. */
export function dashboardTickerHeight(lines: TickerLines = 1): number {
  return TICKER_HEIGHT + (lines - 1) * TICKER_LINE_HEIGHT;
}

/** Strip fill: near-opaque so scenery sparkles never read as glyphs inside the chatter. */
const TICKER_FILL_ALPHA = 0.94;
const PROMPT = "›";
const PADDING_X = 12;
const TEXT_X = TICKER_METRICS.textInsetLeft;
const CARET_GAP = 3;
const CARET_WIDTH = 8;
/** Sample used to measure one monospaced character (averaged over several for sub-pixel widths). */
const MEASURE_SAMPLE = "0000000000";

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
  /** Characters that fit beside the prompt and caret per line. */
  private readonly maxChars: number;
  private readonly maxLines: TickerLines;
  private readonly charWidth: number;
  readonly tickerHeight: number;
  private lines: readonly string[];
  private lineIndex = 0;
  /** Current line, wrapped and joined with "\n" (the newline costs one typewriter tick). */
  private current = "";
  private shownChars = -1;
  private elapsedMs = 0;
  private caretTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, options: DashboardTickerOptions) {
    super(scene, options.x, options.y);
    this.charsPerSecond = options.charsPerSecond ?? 34;
    this.holdMs = options.holdMs ?? 3600;
    this.lines = options.lines ?? [];
    this.maxLines = options.maxLines ?? 1;
    this.tickerHeight = dashboardTickerHeight(this.maxLines);
    const height = this.tickerHeight;

    if (options.background ?? true) {
      const g = scene.add.graphics();
      g.fillStyle(colorNumber(colors.cosmosPanel), TICKER_FILL_ALPHA);
      g.fillRoundedRect(0, 0, options.width, height, 6);
      g.lineStyle(2, colorNumber(colors.plaster), 0.12);
      g.strokeRoundedRect(1, 1, options.width - 2, height - 2, 5);
      this.add(g);
    }

    // The prompt sits on the first text line (centred when only one line is reserved).
    const firstLineY = this.maxLines === 1 ? height / 2 : TICKER_HEIGHT / 2;
    const prompt = scene.add
      .text(PADDING_X, firstLineY, PROMPT, monoStyle({ size: 15, bold: true, color: colors.ember }))
      .setOrigin(0, 0.5);
    this.lineText = scene.add
      .text(TEXT_X, firstLineY, MEASURE_SAMPLE, monoStyle({ size: TICKER_METRICS.fontPx, color: colors.plaster }))
      .setOrigin(0, 0.5)
      .setAlpha(0.88);
    this.lineText.setLineSpacing(TICKER_LINE_HEIGHT - this.lineText.height);
    this.charWidth = this.lineText.width / MEASURE_SAMPLE.length;
    this.maxChars = monoCharsThatFit(options.width - TEXT_X - TICKER_METRICS.textInsetRight, this.charWidth);
    this.lineText.setText("");
    this.caret = scene.add.rectangle(0, firstLineY, CARET_WIDTH, 14, colorNumber(colors.ember)).setOrigin(0, 0.5);
    this.add([prompt, this.lineText, this.caret]);
    this.setSize(options.width, height);
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
    this.current = wrapMonoLines(line, this.maxChars, this.maxLines).join("\n");
    this.elapsedMs = 0;
    this.shownChars = -1;
    this.render(isReducedMotion() ? this.current.length : 0);
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
    const visible = this.current.slice(0, visibleChars);
    this.lineText.setText(visible);
    // Wrapped text grows downward from the first line; the caret follows the last visible line.
    const lineCount = visible.split("\n").length;
    const lastLine = visible.slice(visible.lastIndexOf("\n") + 1);
    const firstLineY = this.maxLines === 1 ? this.tickerHeight / 2 : TICKER_HEIGHT / 2;
    this.lineText.setOrigin(0, 0).setY(Math.round(firstLineY - TICKER_LINE_HEIGHT / 2));
    this.caret.setPosition(Math.round(this.lineText.x + lastLine.length * this.charWidth + CARET_GAP), firstLineY + (lineCount - 1) * TICKER_LINE_HEIGHT);
  }
}
