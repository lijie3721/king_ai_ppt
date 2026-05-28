import type {
  ImageLayoutMap,
  Slide,
  SlideComposition,
  SlideCompositionMap,
  SlideTextFlowMap,
  SlideTextFlowMode,
  SlideTextLayout
} from "../markdown/types";
import type { SlideHealthResult } from "./slideHealth";

export interface SlideAutoLayoutPatch {
  slideCompositions?: SlideCompositionMap;
  slideTextFlows?: SlideTextFlowMap;
  textLayout?: SlideTextLayout;
  imageLayouts?: ImageLayoutMap;
  changed: boolean;
  summary: string;
}

export function createSlideAutoLayoutPatch({
  slide,
  health,
  currentComposition,
  currentTextFlow,
  currentTextLayout
}: {
  slide: Slide;
  health: SlideHealthResult;
  currentComposition?: SlideComposition;
  currentTextFlow?: SlideTextFlowMode;
  currentTextLayout?: SlideTextLayout;
}): SlideAutoLayoutPatch {
  const nextComposition = chooseCurrentSlideComposition(slide, health, currentComposition);
  const nextTextFlow = chooseCurrentSlideTextFlow(slide, health, currentTextFlow);
  const nextTextLayout = shrinkFlowTitleIfNeeded(currentTextLayout, health);
  const slideCompositions = nextComposition ? { [slide.id]: nextComposition } : undefined;
  const slideTextFlows = nextTextFlow ? { [slide.id]: nextTextFlow } : undefined;
  const changed = Boolean(slideCompositions || slideTextFlows || nextTextLayout);

  return {
    slideCompositions,
    slideTextFlows,
    textLayout: nextTextLayout,
    changed,
    summary: changed ? buildAutoLayoutSummary(slideCompositions, slideTextFlows, nextTextLayout) : "本页已经接近推荐布局"
  };
}

function chooseCurrentSlideComposition(
  slide: Slide,
  health: SlideHealthResult,
  currentComposition: SlideComposition | undefined
): SlideComposition | undefined {
  const hasOverlap = health.issues.some((issue) => issue.type === "element-overlap" && issue.severity === "danger");
  const hasImages = slide.imageAssetIds.length > 0 || slide.layout === "image-hero";
  const desired = hasImages ? "image-right" : hasOverlap ? "left-heavy" : undefined;
  if (!desired || desired === currentComposition) return undefined;
  return desired;
}

function chooseCurrentSlideTextFlow(
  slide: Slide,
  health: SlideHealthResult,
  currentTextFlow: SlideTextFlowMode | undefined
): SlideTextFlowMode | undefined {
  const bulletCount = countListItems(slide.markdown);
  const hasCrowding = health.issues.some(
    (issue) => issue.type === "crowded-slide" || (issue.type === "element-overlap" && issue.severity === "danger")
  );
  const desired: SlideTextFlowMode = bulletCount >= 6 ? "grid" : bulletCount >= 3 || hasCrowding ? "two" : "auto";
  if (desired === "auto") return currentTextFlow && currentTextFlow !== "auto" ? "auto" : undefined;
  return desired === currentTextFlow ? undefined : desired;
}

function shrinkFlowTitleIfNeeded(currentTextLayout: SlideTextLayout | undefined, health: SlideHealthResult): SlideTextLayout | undefined {
  const shouldShrinkTitle = health.issues.some((issue) => issue.type === "title-overflow" || issue.message === "标题和正文重叠");
  if (!shouldShrinkTitle || currentTextLayout?.title?.mode === "free") return undefined;
  const currentStyle = currentTextLayout?.title?.style ?? {};
  const currentFontSize = currentStyle.fontSize ?? 64;
  const nextFontSize = Math.max(44, Math.min(currentFontSize, 56));
  if (currentStyle.fontSize === nextFontSize && currentStyle.lineHeight === 0.95) return undefined;
  return {
    ...(currentTextLayout ?? {}),
    title: {
      x: currentTextLayout?.title?.x ?? 50,
      y: currentTextLayout?.title?.y ?? 50,
      style: {
        ...currentStyle,
        fontSize: nextFontSize,
        lineHeight: 0.95
      }
    }
  };
}

function buildAutoLayoutSummary(
  slideCompositions: SlideCompositionMap | undefined,
  slideTextFlows: SlideTextFlowMap | undefined,
  textLayout: SlideTextLayout | undefined
) {
  const changes: string[] = [];
  if (slideCompositions) changes.push("调整版式");
  if (slideTextFlows) changes.push("优化分栏");
  if (textLayout) changes.push("压缩标题");
  return `已美化本页：${changes.join("、")}`;
}

function countListItems(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line)).length;
}
