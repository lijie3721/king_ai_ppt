export interface SlideRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type SlideMeasuredElementKind = "title" | "text" | "image";

export interface SlideMeasuredElement {
  id: string;
  kind: SlideMeasuredElementKind;
  rect: SlideRect;
  isFree?: boolean;
}

export interface SlideMeasure {
  canvas: SlideRect;
  elements: SlideMeasuredElement[];
}

export function toSlideRect(rect: DOMRect): SlideRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}
