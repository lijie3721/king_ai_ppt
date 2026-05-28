import { describe, expect, it } from "vitest";
import { analyzeSlideHealth } from "./slideHealth";
import type { SlideMeasure, SlideRect } from "./slideMeasure";

const canvas: SlideRect = { left: 0, top: 0, right: 1000, bottom: 562.5, width: 1000, height: 562.5 };

describe("slide health", () => {
  it("reports a healthy slide when elements stay separated inside the safe area", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "title", kind: "title", rect: rect(100, 80, 460, 90), layout: "flow" },
        { id: "body", kind: "text", rect: rect(110, 210, 520, 180), layout: "flow" }
      ]
    });

    expect(result.isHealthy).toBe(true);
    expect(result.summary).toBe("本页状态良好");
  });

  it("does not flag a normal grid scatter page as title overflow or overlap", () => {
    const result = analyzeSlideHealth({
      canvas,
      textFlow: "grid",
      elements: [
        { id: "title", kind: "title", rect: rect(36, 56, 410, 86), layout: "flow" },
        { id: "block-1", kind: "text", rect: rect(64, 168, 250, 72), layout: "flow" },
        { id: "block-2", kind: "text", rect: rect(380, 170, 250, 72), layout: "flow" },
        { id: "block-3", kind: "text", rect: rect(696, 170, 250, 72), layout: "flow" },
        { id: "block-4", kind: "text", rect: rect(66, 344, 250, 72), layout: "flow" },
        { id: "block-5", kind: "text", rect: rect(382, 344, 250, 72), layout: "flow" },
        { id: "block-6", kind: "text", rect: rect(698, 344, 250, 72), layout: "flow" }
      ]
    });

    expect(result.isHealthy).toBe(true);
    expect(result.summary).toBe("本页状态良好");
  });

  it("allows titles that are inside the page even when close to the safe inset", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "title", kind: "title", rect: rect(18, 22, 500, 100), layout: "flow" },
        { id: "body", kind: "text", rect: rect(120, 180, 520, 130), layout: "flow" }
      ]
    });

    expect(result.isHealthy).toBe(true);
  });

  it("detects title overflow and title-body overlap", () => {
    const result = analyzeSlideHealth({
      canvas,
      elements: [
        { id: "title", kind: "title", rect: rect(-20, 40, 620, 220), layout: "flow" },
        { id: "body", kind: "text", rect: rect(100, 190, 520, 160), isFree: true, layout: "free" }
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
        { id: "body", kind: "text", rect: rect(120, 180, 360, 180), isFree: true, layout: "free" },
        { id: "img_1", kind: "image", rect: rect(240, 220, 360, 210), isFree: true, layout: "free" }
      ]
    });

    expect(result.issues.some((issue) => issue.message === "图片和内容重叠")).toBe(true);
  });
});

function rect(left: number, top: number, width: number, height: number): SlideRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}
