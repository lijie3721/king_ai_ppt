import { describe, expect, it } from "vitest";
import { beautifyDeckLayout } from "./deckBeautify";
import type { Slide } from "../markdown/types";

describe("deck beautify", () => {
  it("varies text slide compositions and uses text flow for dense content", () => {
    const result = beautifyDeckLayout([
      buildSlide({ id: "slide-1", index: 0, layout: "cover", markdown: "# 封面" }),
      buildSlide({ id: "slide-2", index: 1, layout: "bullets", markdown: "## 第一页\n\n- A\n- B\n- C\n- D" }),
      buildSlide({ id: "slide-3", index: 2, layout: "bullets", markdown: "## 第二页\n\n短内容" }),
      buildSlide({ id: "slide-4", index: 3, layout: "bullets", markdown: "## 第三页\n\n- A\n- B\n- C\n- D\n- E\n- F" })
    ]);

    expect(result.slideCompositions["slide-1"]).toBe("cover-stage");
    expect(result.slideCompositions["slide-2"]).toBe("left-heavy");
    expect(result.slideCompositions["slide-3"]).toBe("poster-bottom");
    expect(result.slideCompositions["slide-4"]).toBe("right-heavy");
    expect(result.slideTextFlows["slide-2"]).toBe("two");
    expect(result.slideTextFlows["slide-4"]).toBe("grid");
    expect(result.summary.join("，")).toContain("优化分栏");
  });

  it("uses image layouts for image slides without touching manual text layouts", () => {
    const result = beautifyDeckLayout(
      [
        buildSlide({ id: "slide-1", index: 0, layout: "image-hero", imageAssetIds: ["img_1"] }),
        buildSlide({ id: "slide-2", index: 1, layout: "image-hero", imageAssetIds: ["img_2"] }),
        buildSlide({ id: "slide-3", index: 2, layout: "bullets", markdown: "## 手动页\n\n- A\n- B\n- C\n- D" })
      ],
      {},
      {},
      { "slide-3": { body: { x: 50, y: 55, mode: "free", width: 44 } } }
    );

    expect(result.slideCompositions["slide-1"]).toBe("image-right");
    expect(result.slideCompositions["slide-2"]).toBe("image-left");
    expect(result.slideTextFlows["slide-3"]).toBeUndefined();
  });
});

function buildSlide(overrides: Partial<Slide>): Slide {
  return {
    html: "",
    id: `slide-${overrides.index ?? 0}`,
    imageAssetIds: [],
    index: 0,
    layout: "bullets",
    markdown: "",
    title: "Slide",
    ...overrides
  };
}
