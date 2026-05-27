import { describe, expect, it } from "vitest";
import { analyzeSlideHealth } from "./slideHealth";
import type { SlideMeasure, SlideRect } from "./slideMeasure";

const canvas: SlideRect = { left: 0, top: 0, right: 1000, bottom: 562.5, width: 1000, height: 562.5 };

describe("slide health", () => {
  it("reports a healthy slide when elements stay separated inside the safe area", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "title", kind: "title", rect: rect(100, 80, 460, 90) },
        { id: "body", kind: "text", rect: rect(110, 210, 520, 180) }
      ]
    });

    expect(result.isHealthy).toBe(true);
    expect(result.summary).toBe("本页状态良好");
  });

  it("detects title overflow and title-body overlap", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "title", kind: "title", rect: rect(-20, 40, 620, 220) },
        { id: "body", kind: "text", rect: rect(100, 190, 520, 160), isFree: true }
      ]
    });

    expect(result.isHealthy).toBe(false);
    expect(result.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining(["title-overflow", "element-overlap"]));
    expect(result.summary).toContain("发现");
  });

  it("detects image and text overlap", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "body", kind: "text", rect: rect(120, 180, 360, 180), isFree: true },
        { id: "img_1", kind: "image", rect: rect(240, 220, 360, 210), isFree: true }
      ]
    });

    expect(result.issues.some((issue) => issue.message === "图片和内容重叠")).toBe(true);
  });
});

function rect(left: number, top: number, width: number, height: number): SlideRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}
