import type Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { campaignLandingScenery, type CampaignLandingDecor, type LandingDecorProp } from "../../data/landingScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { drawSpans, filledEllipseSpans } from "./pixelShapes";

/** Authored foreground pieces, painted once on the same 2x grid as the berth art. */
export function createCampaignPorchDecor(
  scene: Phaser.Scene, theme: CampaignThemeDefinition, decor: CampaignLandingDecor, recipientX: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth.world);
  const p = theme.palette;
  const ink = colorNumber(colors.ink);
  const light = colorNumber(p.light);
  const accent = colorNumber(p.accent);
  const ground = colorNumber(p.ground);
  const plaster = colorNumber(colors.parchment);
  const rect = (x: number, y: number, w: number, h: number, color: number, alpha = 1): void => {
    g.fillStyle(color, alpha);
    g.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.round(w / 2) * 2, Math.round(h / 2) * 2);
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, color: number, alpha = 1): void => {
    g.fillStyle(color, alpha);
    drawSpans(g, x, y, filledEllipseSpans(rx, ry, 2), 2);
  };
  const pool = (x: number, y: number, width: number): void => {
    for (let i = 3; i > 0; i -= 1) ellipse(x, y, width + i * 10, 6 + i * 4, light, 0.035);
  };

  const base = campaignLandingScenery.groundTopY;
  const house = decor.porch;
  const left = recipientX - house.width / 2;
  const top = base - house.height;
  // Small inhabited doorway behind the waiting recipient; lit sill opens towards the pad.
  pool(recipientX - 36, base + 8, 96);
  rect(left - 4, top - 4, house.width + 8, house.height + 8, ink);
  rect(left, top, house.width, house.height, ground);
  for (let y = top + 14; y < base; y += 18) rect(left + 4, y, house.width - 8, 2, accent, 0.25);
  if (house.roof === "pitched") {
    for (let i = 0; i < 15; i += 1) {
      rect(left - 12 + i * 6, top - i * 4, house.width + 24 - i * 12, 6, ink);
      rect(left - 8 + i * 6, top - i * 4, house.width + 16 - i * 12, 2, accent);
    }
  } else {
    rect(left - 12, top - 16, house.width + 24, 18, ink);
    rect(left - 10, top - 14, house.width + 20, 6, accent);
    for (let x = left; x < left + house.width; x += 20) rect(x, top - 6, 10, 4, light, 0.7);
  }
  rect(left + 16, base - 100, 54, 100, ink);
  rect(left + 20, base - 96, 46, 96, light, 0.85);
  rect(left + 28, base - 88, 30, 88, plaster, 0.28);
  rect(left + 10, base - 4, 68, 8, accent);
  rect(left + 58, base - 52, 4, 4, ink);
  const wx = left + house.width - 52;
  if (house.window === "round") {
    ellipse(wx, top + 56, 26, 24, ink);
    ellipse(wx, top + 56, 20, 18, light);
  } else {
    rect(wx - 28, top + 30, 56, 50, ink);
    rect(wx - 24, top + 34, 48, 42, light);
  }
  rect(wx - 2, top + 34, 4, 42, ink);
  rect(wx - 24, top + 54, 48, 4, ink);
  rect(left - 16, base + 4, house.width + 32, 8, ink);
  rect(left - 14, base + 4, house.width + 28, 2, light, 0.7);

  for (const rock of decor.rocks) {
    ellipse(rock.x, rock.y + 6, rock.size + 6, 8, ink, 0.3);
    ellipse(rock.x, rock.y - 6, rock.size, rock.size / 3, ink);
    ellipse(rock.x - 2, rock.y - 10, rock.size - 4, rock.size / 3 - 4, ground);
    rect(rock.x - rock.size / 2, rock.y - rock.size / 3 - 8, rock.size, 2, accent, 0.8);
    rect(rock.x - 6, rock.y - 10, 12, 2, light, 0.25);
  }
  // Irregular, authored-looking mineral chips on the foreground band; the pad stays clear.
  for (let i = 0; i < 48; i += 1) {
    const x = (i * 178 + 26) % 1280;
    const y = base + 20 + ((i * 14) % 48);
    rect(x, y, i % 3 === 0 ? 8 : 4, 2, i % 4 === 0 ? light : ink, 0.25);
  }

  const prop = ({ kind, x: authoredX, y }: LandingDecorProp): void => {
    // Right-side porch pieces follow its touch-layout shift, leaving the touch column clear.
    const x = authoredX > 850 ? authoredX + recipientX - campaignLandingScenery.recipient.x : authoredX;
    switch (kind) {
      case "crate":
        rect(x - 32, y - 48, 64, 48, ink); rect(x - 28, y - 44, 56, 40, accent);
        rect(x - 28, y - 28, 56, 4, ground); rect(x - 4, y - 44, 8, 40, ground);
        rect(x - 22, y - 40, 16, 6, plaster); rect(x + 10, y - 18, 12, 6, light);
        rect(x - 34, y - 52, 68, 6, plaster); break;
      case "bolts":
        for (let i = 0; i < 4; i += 1) { rect(x + i * 12, y - (i % 2) * 4, 8, 8, ink); rect(x + i * 12 + 2, y + 2 - (i % 2) * 4, 4, 4, plaster); } break;
      case "chair":
        rect(x - 18, y - 68, 8, 68, ink); rect(x + 16, y - 30, 6, 30, ink);
        rect(x - 16, y - 64, 34, 22, accent); rect(x - 18, y - 32, 44, 8, light); break;
      case "lamp":
        pool(x, y + 8, 44); rect(x - 4, y - 92, 8, 92, ink);
        rect(x - 16, y - 102, 32, 26, ink); rect(x - 12, y - 98, 24, 18, light);
        rect(x - 18, y - 106, 36, 6, accent); rect(x - 16, y - 4, 32, 6, ink); break;
      case "lantern":
        pool(x, y, 38); rect(x - 4, y - 132, 6, 132, ink); rect(x - 6, y - 132, 36, 4, accent);
        rect(x + 20, y - 128, 2, 16, plaster); ellipse(x + 22, y - 92, 18, 24, light);
        for (let ox = -10; ox <= 10; ox += 10) rect(x + 22 + ox, y - 112, 2, 40, accent, 0.8);
        rect(x + 8, y - 118, 28, 6, ink); rect(x + 10, y - 70, 24, 4, ink); break;
      case "bush":
        rect(x - 44, y - 4, 88, 8, ink);
        for (let i = 0; i < 4; i += 1) { ellipse(x - 30 + i * 20, y - 18 - (i % 2) * 8, 24, 20, ground); ellipse(x - 32 + i * 20, y - 26 - (i % 2) * 8, 20, 12, accent); rect(x - 40 + i * 20, y - 30 - (i % 2) * 8, 12, 2, light, 0.5); } break;
      case "mist":
        for (let i = 0; i < 3; i += 1) { ellipse(x + i * 24, y - i * 8, 68 - i * 12, 8, plaster, 0.08); rect(x + 16 + i * 24, y - 18 - i * 8, 28, 2, light, 0.16); } break;
      case "chimney":
        rect(x - 18, y - 100, 36, 100, ink); rect(x - 14, y - 96, 28, 94, accent);
        for (let i = 0; i < 7; i += 1) rect(x - 12, y - 86 + i * 12, 24, 2, ground);
        rect(x - 22, y - 104, 44, 8, plaster);
        for (let i = 0; i < 3; i += 1) ellipse(x + i * 8, y - 122 - i * 18, 18 + i * 6, 8, light, 0.12); break;
      case "bread-rack":
        rect(x - 38, y - 110, 8, 110, ink); rect(x + 30, y - 110, 8, 110, ink);
        for (let shelf = 0; shelf < 3; shelf += 1) { const sy = y - 12 - shelf * 32; rect(x - 38, sy, 76, 6, accent); for (let loaf = 0; loaf < 3; loaf += 1) { ellipse(x - 22 + loaf * 22, sy - 10, 10, 8, light); rect(x - 26 + loaf * 22, sy - 14, 2, 6, plaster); } } break;
      case "oven":
        pool(x, y + 8, 64); rect(x - 38, y - 82, 76, 82, ink); rect(x - 34, y - 78, 68, 74, accent);
        ellipse(x, y - 38, 26, 28, ink); ellipse(x, y - 36, 20, 22, light); rect(x - 22, y - 12, 44, 10, ink);
        for (let i = 0; i < 3; i += 1) rect(x - 14 + i * 12, y - 28 - (i % 2) * 8, 6, 16, plaster, 0.7); break;
      case "puddle":
        ellipse(x, y, 74, 10, ink, 0.7); ellipse(x, y - 2, 66, 6, accent, 0.6);
        rect(x - 44, y - 4, 40, 2, light, 0.5); rect(x + 8, y, 26, 2, plaster, 0.35); break;
      case "bunting":
        for (let i = 0; i < 12; i += 1) { const by = y + Math.round(Math.sin(i / 11 * Math.PI) * 12 / 2) * 2; rect(x + i * 20, by, 20, 2, plaster, 0.8); for (let r = 0; r < 7; r += 1) rect(x + i * 20 + r, by + 2 + r * 2, 14 - r * 2, 2, i % 2 === 0 ? accent : light); } break;
      case "mailbox":
        rect(x - 4, y - 54, 8, 54, ink); rect(x - 24, y - 82, 48, 30, ink);
        rect(x - 20, y - 78, 40, 22, accent); rect(x - 12, y - 70, 24, 4, ink);
        rect(x + 18, y - 96, 4, 36, plaster); rect(x + 22, y - 96, 14, 10, light); break;
    }
  };
  decor.props.forEach(prop);
  return g;
}
