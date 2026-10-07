import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

const SIZE = 1_024;
const GRAIN_LINES = 150;

/**
 * Procedural wood for the board top: a warm base with long grain lines and
 * a little speckle. Generated once at startup so there is no download.
 */
export const createWoodTexture = (): CanvasTexture | null => {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const base = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  base.addColorStop(0, "#a4683c");
  base.addColorStop(0.5, "#95592f");
  base.addColorStop(1, "#7d4824");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grain: long, gently waving lines across the plank, in two weights, so
  // the top reads as planed wood rather than a tree's end grain.
  for (let line = 0; line < GRAIN_LINES; line += 1) {
    const y0 = (line / GRAIN_LINES) * SIZE + (Math.random() - 0.5) * 10;
    const heavy = Math.random() < 0.22;
    ctx.lineWidth = heavy ? 2.4 : 1.2;
    ctx.strokeStyle = heavy
      ? `rgba(52, 26, 10, ${0.16 + Math.random() * 0.1})`
      : `rgba(214, 160, 110, ${0.07 + Math.random() * 0.06})`;
    const wave = 6 + Math.random() * 10;
    const period = 180 + Math.random() * 260;
    const phase = Math.random() * Math.PI * 2;
    ctx.beginPath();
    for (let x = 0; x <= SIZE; x += 8) {
      const y =
        y0 +
        Math.sin(x / period + phase) * wave +
        Math.sin(x / 37 + phase * 2) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fine speckle so the finish is not perfectly smooth.
  for (let i = 0; i < 2_000; i += 1) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const alpha = 0.03 + Math.random() * 0.04;
    ctx.fillStyle =
      Math.random() > 0.5
        ? `rgba(255, 220, 180, ${alpha})`
        : `rgba(40, 20, 8, ${alpha})`;
    ctx.fillRect(x, y, 2, 1);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/**
 * A radial shade for the hole dimples: dark at the center, pale at the lip,
 * multiplied by each hole's wood or zone tint.
 */
export const createDimpleTexture = (): CanvasTexture | null => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.42,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  gradient.addColorStop(0, "#222");
  gradient.addColorStop(0.55, "#555");
  gradient.addColorStop(0.9, "#cfcfcf");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

/**
 * A glowing grid for the neon table: thin lines on a transparent-black
 * field, each wrapped in a soft halo, tiled across the surface as an
 * emissive map. The halo is what music swells: a brighter emissive makes
 * the line bloom outward rather than merely whiten.
 */
export const createGridTexture = (lineColor: string): CanvasTexture | null => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = lineColor;
  const strokes: readonly [width: number, alpha: number][] = [
    [14, 0.05],
    [7, 0.1],
    [2, 0.55],
  ];
  for (const [width, alpha] of strokes) {
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(1, size);
    ctx.moveTo(0, 1);
    ctx.lineTo(size, 1);
    // The halo of the line on the opposite edge wraps around the tile.
    ctx.moveTo(size + 1, 0);
    ctx.lineTo(size + 1, size);
    ctx.moveTo(0, size + 1);
    ctx.lineTo(size, size + 1);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
};
