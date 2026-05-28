import type { SlideMeasure, SlideMeasuredElement, SlideRect } from "./slideMeasure";

export type SlideHealthIssueType = "title-overflow" | "element-overflow" | "element-overlap" | "crowded-slide" | "sparse-slide";

export interface SlideHealthIssue {
  type: SlideHealthIssueType;
  message: string;
  elementIds: string[];
  severity: "warning" | "danger";
}

export interface SlideHealthResult {
  issues: SlideHealthIssue[];
  isHealthy: boolean;
  summary: string;
}

const pageOverflowToleranceRatio = 0.012;
const minOverlapArea = 400;
const minOverlapRatio = 0.18;

export function analyzeSlideHealth(measure: SlideMeasure): SlideHealthResult {
  const issues: SlideHealthIssue[] = [];
  const pageBounds = expandRect(measure.canvas, pageOverflowToleranceRatio);
  const visibleElements = measure.elements.filter((element) => element.rect.width > 0 && element.rect.height > 0);
  const title = visibleElements.find((element) => element.kind === "title");

  if (title && isOutside(title.rect, pageBounds)) {
    issues.push({
      type: "title-overflow",
      message: "标题超出页面",
      elementIds: [title.id],
      severity: "danger"
    });
  }

  for (const element of visibleElements) {
    if (element.kind !== "title" && isOutside(element.rect, pageBounds)) {
      issues.push({
        type: "element-overflow",
        message: element.kind === "image" ? "图片超出页面" : "正文超出页面",
        elementIds: [element.id],
        severity: "danger"
      });
    }
  }

  for (let index = 0; index < visibleElements.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < visibleElements.length; nextIndex += 1) {
      const first = visibleElements[index];
      const second = visibleElements[nextIndex];
      if (shouldSkipOverlap(first, second, measure)) continue;
      if (hasMeaningfulOverlap(first.rect, second.rect)) {
        issues.push({
          type: "element-overlap",
          message: overlapMessage(first, second),
          elementIds: [first.id, second.id],
          severity: "danger"
        });
      }
    }
  }

  const occupiedArea = visibleElements.reduce((area, element) => area + element.rect.width * element.rect.height, 0);
  const canvasArea = measure.canvas.width * measure.canvas.height;
  if (canvasArea > 0 && occupiedArea / canvasArea > 0.72) {
    issues.push({
      type: "crowded-slide",
      message: "页面内容偏拥挤",
      elementIds: visibleElements.map((element) => element.id),
      severity: "warning"
    });
  }
  if (visibleElements.length <= 2 && canvasArea > 0 && occupiedArea / canvasArea < 0.12) {
    issues.push({
      type: "sparse-slide",
      message: "页面内容偏空",
      elementIds: visibleElements.map((element) => element.id),
      severity: "warning"
    });
  }

  return {
    issues,
    isHealthy: issues.length === 0,
    summary: buildHealthSummary(issues)
  };
}

function buildHealthSummary(issues: SlideHealthIssue[]) {
  if (issues.length === 0) return "本页状态良好";
  const messages = [...new Set(issues.map((issue) => issue.message))];
  return `发现 ${issues.length} 个问题：${messages.slice(0, 3).join("、")}`;
}

function overlapMessage(first: SlideMeasuredElement, second: SlideMeasuredElement) {
  if (first.kind === "image" || second.kind === "image") return "图片和内容重叠";
  if (first.kind === "title" || second.kind === "title") return "标题和正文重叠";
  return "页面元素重叠";
}

function expandRect(rect: SlideRect, ratio: number): SlideRect {
  const insetX = rect.width * ratio;
  const insetY = rect.height * ratio;
  return {
    left: rect.left - insetX,
    top: rect.top - insetY,
    right: rect.right + insetX,
    bottom: rect.bottom + insetY,
    width: rect.width + insetX * 2,
    height: rect.height + insetY * 2
  };
}

function isOutside(rect: SlideRect, bounds: SlideRect) {
  return rect.left < bounds.left || rect.top < bounds.top || rect.right > bounds.right || rect.bottom > bounds.bottom;
}

function overlapArea(first: SlideRect, second: SlideRect) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function hasMeaningfulOverlap(first: SlideRect, second: SlideRect) {
  const area = overlapArea(first, second);
  if (area <= minOverlapArea) return false;
  const firstArea = first.width * first.height;
  const secondArea = second.width * second.height;
  const smallerArea = Math.min(firstArea, secondArea);
  return smallerArea > 0 && area / smallerArea >= minOverlapRatio;
}

function shouldSkipOverlap(first: SlideMeasuredElement, second: SlideMeasuredElement, measure: SlideMeasure) {
  const firstIsFlow = isFlowElement(first);
  const secondIsFlow = isFlowElement(second);
  if (first.kind === "text" && second.kind === "text" && firstIsFlow && secondIsFlow) return true;
  if (measure.textFlow === "grid" && firstIsFlow && secondIsFlow) return true;
  return false;
}

function isFlowElement(element: SlideMeasuredElement) {
  return element.layout === "flow" || (!element.isFree && element.layout !== "free");
}
