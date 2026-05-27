import { describe, expect, it } from "vitest";
import { createSlideAutoLayoutPatch } from "./slideAutoLayout";
import type { Slide } from "../markdown/types";

const slide: Slide = {
  id: "slide-1",
  index: 0,
  markdown: "# 当前挑战\n\n- A\n- B\n- C\n- D",
  html: "<h1>当前挑战</h1><ul><li>A</li><li>B</li><li>C</li><li>D</li></ul>",
  title: "当前挑战",
  layout: "bullets",
  imageAssetIds: []
};

describe("slide auto layout", () => {
  it("creates a current-slide patch for crowded text slides", () => {
    const patch = createSlideAutoLayoutPatch({
      slide,
      health: {
        isHealthy: false,
        summary: "发现 1 个问题：标题和正文重叠",
        issues: [{ type: "element-overlap", message: "标题和正文重叠", elementIds: ["title", "body"], severity: "danger" }]
      },
      currentComposition: "center-stage",
      currentTextFlow: "auto",
      currentTextLayout: {}
    });

    expect(patch.changed).toBe(true);
    expect(patch.slideCompositions).toEqual({ "slide-1": "left-heavy" });
    expect(patch.slideTextFlows).toEqual({ "slide-1": "two" });
    expect(patch.textLayout?.title?.style?.fontSize).toBe(56);
  });

  it("does not rewrite a manually positioned free title", () => {
    const patch = createSlideAutoLayoutPatch({
      slide,
      health: {
        isHealthy: false,
        summary: "发现 1 个问题：标题超出安全区",
        issues: [{ type: "title-overflow", message: "标题超出安全区", elementIds: ["title"], severity: "danger" }]
      },
      currentComposition: "left-heavy",
      currentTextFlow: "two",
      currentTextLayout: { title: { x: 20, y: 20, mode: "free", width: 44 } }
    });

    expect(patch.textLayout).toBeUndefined();
  });
});
