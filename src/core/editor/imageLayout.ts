import type { ImageLayout } from "../markdown/types";

const minImageWidth = 12;
const maxImageWidth = 120;

export function normalizeImageLayout(layout: ImageLayout): ImageLayout {
  return {
    x: roundLayoutValue(clamp(layout.x, 0, 100)),
    y: roundLayoutValue(clamp(layout.y, 0, 100)),
    width: roundLayoutValue(clamp(layout.width, minImageWidth, maxImageWidth))
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundLayoutValue(value: number): number {
  return Math.round(value * 10) / 10;
}
