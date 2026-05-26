import type { Slide, SlideComposition, SlideCompositionMap, SlideTextFlowMap, SlideTextFlowMode, TextLayoutMap } from "../markdown/types";
import { getSlideComposition } from "./slideComposition";

export interface BeautifyDeckResult {
  slideCompositions: SlideCompositionMap;
  slideTextFlows: SlideTextFlowMap;
  changedSlideIds: string[];
  summary: string[];
}

const textRhythm: SlideComposition[] = ["left-heavy", "split-panel", "right-heavy", "poster-bottom", "center-stage"];
const imageRhythm: SlideComposition[] = ["image-right", "image-left", "image-full-bleed"];

export function beautifyDeckLayout(
  slides: Slide[],
  currentCompositions: SlideCompositionMap = {},
  currentTextFlows: SlideTextFlowMap = {},
  textLayouts: TextLayoutMap = {}
): BeautifyDeckResult {
  const slideCompositions: SlideCompositionMap = {};
  const slideTextFlows: SlideTextFlowMap = { ...currentTextFlows };
  const changedSlideIds: string[] = [];
  let textIndex = 0;
  let imageIndex = 0;
  let compositionChanges = 0;
  let textFlowChanges = 0;

  for (const slide of slides) {
    const currentComposition = getSlideComposition(slide, currentCompositions[slide.id]);
    const nextComposition = chooseBeautifiedComposition(slide, textIndex, imageIndex);
    if (isTextSlide(slide)) textIndex += 1;
    if (slide.layout === "image-hero" || slide.imageAssetIds.length > 0) imageIndex += 1;

    slideCompositions[slide.id] = nextComposition;
    if (nextComposition !== currentComposition) {
      compositionChanges += 1;
      changedSlideIds.push(slide.id);
    }

    if (!hasManualTextLayout(textLayouts[slide.id])) {
      const currentTextFlow = currentTextFlows[slide.id] ?? "auto";
      const nextTextFlow = chooseBeautifiedTextFlow(slide);
      if (nextTextFlow === "auto") {
        delete slideTextFlows[slide.id];
      } else {
        slideTextFlows[slide.id] = nextTextFlow;
      }
      if (nextTextFlow !== currentTextFlow && !changedSlideIds.includes(slide.id)) {
        changedSlideIds.push(slide.id);
      }
      if (nextTextFlow !== currentTextFlow) {
        textFlowChanges += 1;
      }
    }
  }

  return {
    slideCompositions,
    slideTextFlows,
    changedSlideIds,
    summary: buildBeautifySummary(slides.length, compositionChanges, textFlowChanges)
  };
}

function chooseBeautifiedComposition(slide: Slide, textIndex: number, imageIndex: number): SlideComposition {
  if (slide.layout === "cover") return "cover-stage";
  if (slide.layout === "section-divider" || slide.layout === "thanks") return "section-band";
  if (slide.layout === "code") return "code-lab";
  if (slide.layout === "image-hero" || slide.imageAssetIds.length > 0) return imageRhythm[imageIndex % imageRhythm.length];
  if (slide.layout === "two-column" || slide.layout === "comparison" || slide.layout === "process-steps" || slide.layout === "timeline") {
    return textIndex % 2 === 0 ? "split-panel" : "right-heavy";
  }
  if (contentScore(slide) <= 2) return textIndex % 2 === 0 ? "center-stage" : "poster-bottom";
  return textRhythm[textIndex % textRhythm.length];
}

function chooseBeautifiedTextFlow(slide: Slide): SlideTextFlowMode {
  if (!isTextSlide(slide)) return "auto";
  const bulletCount = countListItems(slide.markdown);
  const score = contentScore(slide);
  if (bulletCount >= 6 || score >= 8) return "grid";
  if (bulletCount >= 3 || score >= 5 || slide.layout === "two-column" || slide.layout === "comparison") return "two";
  return "auto";
}

function isTextSlide(slide: Slide) {
  return slide.layout !== "cover" && slide.layout !== "section-divider" && slide.layout !== "thanks" && slide.layout !== "code" && slide.layout !== "image-hero";
}

function contentScore(slide: Slide) {
  return countListItems(slide.markdown) + Math.ceil(stripMarkdownSyntax(slide.markdown).length / 90);
}

function countListItems(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line)).length;
}

function stripMarkdownSyntax(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/[#*_>`~\-[\]()!]/g, "").trim();
}

function hasManualTextLayout(layout: TextLayoutMap[string] | undefined) {
  return Boolean(layout?.title || layout?.body || Object.keys(layout?.blocks ?? {}).length > 0);
}

function buildBeautifySummary(slideCount: number, compositionChanges: number, textFlowChanges: number) {
  const summary = [`已美化 ${slideCount} 页`];
  if (compositionChanges > 0) summary.push(`${compositionChanges} 页调整版式`);
  if (textFlowChanges > 0) summary.push(`${textFlowChanges} 页优化分栏`);
  if (summary.length === 1) summary.push("当前页面已经接近推荐布局");
  return summary;
}
