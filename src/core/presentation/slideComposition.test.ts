import { describe, expect, it } from "vitest";
import {
  getAvailableSlideCompositions,
  getSlideComposition,
  suggestAlternativeSlideCompositions,
  suggestSlideCompositions
} from "./slideComposition";
import type { Slide } from "../markdown/types";

describe("getSlideComposition", () => {
  it("varies text slide composition by slide index", () => {
    expect(getSlideComposition(buildSlide({ index: 1, layout: "bullets" }))).toBe("left-heavy");
    expect(getSlideComposition(buildSlide({ index: 2, layout: "bullets" }))).toBe("split-panel");
    expect(getSlideComposition(buildSlide({ index: 3, layout: "bullets" }))).toBe("right-heavy");
  });

  it("uses image-specific compositions for image slides", () => {
    expect(getSlideComposition(buildSlide({ index: 0, layout: "image-hero" }))).toBe("image-right");
    expect(getSlideComposition(buildSlide({ index: 1, layout: "image-hero" }))).toBe("image-left");
    expect(getSlideComposition(buildSlide({ index: 2, layout: "image-hero" }))).toBe("image-full-bleed");
  });

  it("keeps special slide types visually distinct", () => {
    expect(getSlideComposition(buildSlide({ index: 0, layout: "cover" }))).toBe("cover-stage");
    expect(getSlideComposition(buildSlide({ index: 1, layout: "section-divider" }))).toBe("section-band");
    expect(getSlideComposition(buildSlide({ index: 2, layout: "code" }))).toBe("code-lab");
  });

  it("uses a manual override when it is available for the slide", () => {
    expect(getSlideComposition(buildSlide({ index: 1, layout: "bullets" }), "right-heavy")).toBe("right-heavy");
  });

  it("ignores manual overrides that do not match the slide type", () => {
    expect(getSlideComposition(buildSlide({ index: 1, layout: "bullets" }), "image-full-bleed")).toBe("left-heavy");
  });

  it("lists only appropriate manual compositions for text and image slides", () => {
    expect(getAvailableSlideCompositions(buildSlide({ index: 1, layout: "bullets" }))).toEqual([
      "center-stage",
      "left-heavy",
      "split-panel",
      "right-heavy",
      "poster-bottom"
    ]);
    expect(getAvailableSlideCompositions(buildSlide({ index: 2, layout: "image-hero" }))).toEqual([
      "image-right",
      "image-left",
      "image-full-bleed"
    ]);
  });

  it("suggests varied compositions for a full deck without needing AI", () => {
    const suggestions = suggestSlideCompositions([
      buildSlide({ id: "slide-1", index: 0, layout: "cover" }),
      buildSlide({ id: "slide-2", index: 1, layout: "bullets" }),
      buildSlide({ id: "slide-3", index: 2, layout: "bullets" }),
      buildSlide({ id: "slide-4", index: 3, layout: "image-hero", imageAssetIds: ["img"] }),
      buildSlide({ id: "slide-5", index: 4, layout: "code" }),
      buildSlide({ id: "slide-6", index: 5, layout: "section-divider" })
    ]);

    expect(suggestions).toEqual({
      "slide-1": "cover-stage",
      "slide-2": "left-heavy",
      "slide-3": "split-panel",
      "slide-4": "image-right",
      "slide-5": "code-lab",
      "slide-6": "section-band"
    });
  });

  it("suggests visible alternatives instead of repeating the current composition", () => {
    const slides = [
      buildSlide({ id: "slide-1", index: 0, layout: "cover" }),
      buildSlide({ id: "slide-2", index: 1, layout: "bullets" }),
      buildSlide({ id: "slide-3", index: 2, layout: "bullets" }),
      buildSlide({ id: "slide-4", index: 3, layout: "image-hero", imageAssetIds: ["img"] }),
      buildSlide({ id: "slide-5", index: 4, layout: "code" }),
      buildSlide({ id: "slide-6", index: 5, layout: "section-divider" })
    ];

    const suggestion = suggestAlternativeSlideCompositions(slides);

    expect(suggestion.changedSlideIds).toEqual(["slide-2", "slide-3", "slide-4"]);
    expect(suggestion.slideCompositions["slide-1"]).toBe("cover-stage");
    expect(suggestion.slideCompositions["slide-5"]).toBe("code-lab");
    expect(suggestion.slideCompositions["slide-6"]).toBe("section-band");
    for (const slide of slides) {
      if (!suggestion.changedSlideIds.includes(slide.id)) continue;
      expect(suggestion.slideCompositions[slide.id]).not.toBe(getSlideComposition(slide));
    }
  });

  it("suggests an alternative when the current composition is a manual override", () => {
    const slide = buildSlide({ id: "slide-2", index: 1, layout: "bullets" });

    const suggestion = suggestAlternativeSlideCompositions([slide], { "slide-2": "right-heavy" });

    expect(suggestion.changedSlideIds).toEqual(["slide-2"]);
    expect(suggestion.slideCompositions["slide-2"]).not.toBe("right-heavy");
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
