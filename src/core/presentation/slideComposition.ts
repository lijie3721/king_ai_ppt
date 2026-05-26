import type { Slide, SlideComposition, SlideCompositionMap } from "../markdown/types";

const textCompositions: SlideComposition[] = [
  "center-stage",
  "left-heavy",
  "split-panel",
  "right-heavy",
  "poster-bottom"
];

const imageCompositions: SlideComposition[] = ["image-right", "image-left", "image-full-bleed"];

export const allSlideCompositions: SlideComposition[] = [
  "cover-stage",
  "section-band",
  "code-lab",
  ...textCompositions,
  ...imageCompositions
];

export function getSlideComposition(slide: Slide, override?: SlideComposition): SlideComposition {
  const availableCompositions = getAvailableSlideCompositions(slide);
  if (override && availableCompositions.includes(override)) return override;
  if (slide.layout === "cover") return "cover-stage";
  if (slide.layout === "section-divider" || slide.layout === "thanks") return "section-band";
  if (slide.layout === "code") return "code-lab";
  if (slide.layout === "image-hero") return imageCompositions[slide.index % imageCompositions.length];
  return textCompositions[slide.index % textCompositions.length];
}

export function getAvailableSlideCompositions(slide: Slide): SlideComposition[] {
  if (slide.layout === "cover") return ["cover-stage", ...textCompositions];
  if (slide.layout === "section-divider" || slide.layout === "thanks") return ["section-band", "center-stage", "poster-bottom"];
  if (slide.layout === "code") return ["code-lab", "split-panel", "left-heavy"];
  if (slide.layout === "image-hero") return imageCompositions;
  return textCompositions;
}

export function isSlideComposition(value: unknown): value is SlideComposition {
  return typeof value === "string" && allSlideCompositions.includes(value as SlideComposition);
}

export function suggestSlideCompositions(slides: Slide[]): SlideCompositionMap {
  let textIndex = 0;
  let imageIndex = 0;

  return Object.fromEntries(
    slides.map((slide) => {
      if (slide.layout === "cover") return [slide.id, "cover-stage"];
      if (slide.layout === "section-divider" || slide.layout === "thanks") return [slide.id, "section-band"];
      if (slide.layout === "code") return [slide.id, "code-lab"];
      if (slide.layout === "image-hero" || slide.imageAssetIds.length > 0) {
        const composition = imageCompositions[imageIndex % imageCompositions.length];
        imageIndex += 1;
        return [slide.id, composition];
      }

      const composition = textCompositions[(textIndex + 1) % textCompositions.length];
      textIndex += 1;
      return [slide.id, composition];
    })
  );
}

export interface SlideCompositionSuggestion {
  slideCompositions: SlideCompositionMap;
  changedSlideIds: string[];
}

export function suggestAlternativeSlideCompositions(
  slides: Slide[],
  currentOverrides: SlideCompositionMap = {}
): SlideCompositionSuggestion {
  const slideCompositions: SlideCompositionMap = {};
  const changedSlideIds: string[] = [];

  for (const slide of slides) {
    const currentComposition = getSlideComposition(slide, currentOverrides[slide.id]);
    const nextComposition = getNextComposition(slide, currentComposition);
    slideCompositions[slide.id] = nextComposition;
    if (nextComposition !== currentComposition) {
      changedSlideIds.push(slide.id);
    }
  }

  return { slideCompositions, changedSlideIds };
}

function getNextComposition(slide: Slide, currentComposition: SlideComposition): SlideComposition {
  if (slide.layout === "cover") return currentComposition;
  if (slide.layout === "section-divider" || slide.layout === "thanks") return currentComposition;
  if (slide.layout === "code") return currentComposition;

  const availableCompositions = getAvailableSlideCompositions(slide);
  if (availableCompositions.length < 2) return currentComposition;

  const currentIndex = availableCompositions.indexOf(currentComposition);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  return availableCompositions[nextIndex % availableCompositions.length];
}
