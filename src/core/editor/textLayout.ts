import type { TextBlockLayout } from "../markdown/types";

export function normalizeTextBlockLayout(layout: TextBlockLayout): TextBlockLayout {
  const style = normalizeTextBlockStyle(layout.style);
  return {
    x: roundLayoutValue(clamp(layout.x, 0, 100)),
    y: roundLayoutValue(clamp(layout.y, 0, 100)),
    ...(layout.mode === "free" ? { mode: "free" as const } : {}),
    ...(layout.width === undefined ? {} : { width: roundLayoutValue(clamp(layout.width, 8, 100)) }),
    ...(style ? { style } : {})
  };
}

function normalizeTextBlockStyle(style: TextBlockLayout["style"]): TextBlockLayout["style"] | undefined {
  if (!style) return undefined;
  const nextStyle: NonNullable<TextBlockLayout["style"]> = {};
  if (style.fontSize !== undefined) nextStyle.fontSize = roundLayoutValue(clamp(style.fontSize, 12, 120));
  if (style.fontFamily) nextStyle.fontFamily = style.fontFamily;
  if (style.color) nextStyle.color = style.color;
  if (style.bold !== undefined) nextStyle.bold = style.bold;
  if (style.lineHeight !== undefined) nextStyle.lineHeight = roundLayoutValue(clamp(style.lineHeight, 0.8, 2.4));
  if (style.letterSpacing !== undefined) nextStyle.letterSpacing = roundLayoutValue(clamp(style.letterSpacing, -1, 8));
  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundLayoutValue(value: number): number {
  return Math.round(value * 10) / 10;
}
