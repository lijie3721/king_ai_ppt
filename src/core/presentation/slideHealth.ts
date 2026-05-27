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

const safeInsetRatio = 0.045;
const minOverlapArea = 120;

export function analyzeSlideHealth(measure: SlideMeasure): SlideHealthResult {
  const issues: SlideHealthIssue[] = [];
  const safeArea = insetRect(measure.canvas, safeInsetRatio);
  const visibleElements = measure.elements.filter((element) => element.rect.width > 0 && element.rect.height > 0);
  const title = visibleElements.find((element) => element.kind === "title");

  if (title && isOutside(title.rect, safeArea)) {
    issues.push({
      type: "title-overflow",
      message: "标题超出安全区",
      elementIds: [title.id],
      severity: "danger"
    });
  }

  for (const element of visibleElements) {
    if (element.kind !== "title" && isOutside(element.rect, safeArea)) {
      issues.push({
        type: "element-overflow",
        message: element.kind === "image" ? "图片靠近页面边界" : "正文靠近页面边界",
        elementIds: [element.id],
        severity: "warning"
      });
    }
  }

  for (let index = 0; index < visibleElements.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < visibleElements.length; nextIndex += 1) {
      const first = visibleElements[index];
      const second = visibleElements[nextIndex];
      if (first.kind === "text" && second.kind === "text" && !first.isFree && !second.isFree) continue;
      if (overlapArea(first.rect, second.rect) > minOverlapArea) {
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

function insetRect(rect: SlideRect, ratio: number): SlideRect {
  const insetX = rect.width * ratio;
  const insetY = rect.height * ratio;
  return {
    left: rect.left + insetX,
    top: rect.top + insetY,
    right: rect.right - insetX,
    bottom: rect.bottom - insetY,
    width: Math.max(rect.width - insetX * 2, 0),
    height: Math.max(rect.height - insetY * 2, 0)
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
