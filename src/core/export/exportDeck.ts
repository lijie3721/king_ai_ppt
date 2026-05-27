import type {
  BrandLogoPosition,
  Deck,
  DeckAsset,
  Slide,
  SlideCompositionMap,
  SlideMetadataMap,
  SlideTextFlowMap,
  SlideTextFlowMode,
  SlideTextLayout,
  TextBlockLayout
} from "../markdown/types";
import { createFontFaceCss } from "../fonts/fontCatalog";
import { annotateRevealItems, countRevealItems } from "../presentation/reveal";
import { getSlideComposition } from "../presentation/slideComposition";
import { splitSlideTextBlocks } from "../presentation/textBlocks";
import type { SlideTheme } from "../themes/themes";

export function createStandaloneHtml(
  deck: Deck,
  theme: SlideTheme,
  slideCompositions: SlideCompositionMap = {},
  brandLogoAsset?: DeckAsset,
  brandLogoPosition: BrandLogoPosition = "top-right",
  slideTextFlowsOrTextLayouts: SlideTextFlowMap | Record<string, SlideTextLayout> = {},
  textLayoutsArg: Record<string, SlideTextLayout> = {},
  speakerNotes: SlideMetadataMap = {},
  slideIntents: SlideMetadataMap = {},
  slideRevealPlans: SlideMetadataMap = {}
): string {
  const usingLegacyTextLayoutsArg = Object.values(slideTextFlowsOrTextLayouts).some((value) => value && typeof value === "object");
  const slideTextFlows = usingLegacyTextLayoutsArg ? {} : (slideTextFlowsOrTextLayouts as SlideTextFlowMap);
  const textLayouts = usingLegacyTextLayoutsArg ? (slideTextFlowsOrTextLayouts as Record<string, SlideTextLayout>) : textLayoutsArg;
  const slides = deck.slides
    .map((slide) =>
      renderExportSlide(slide, slideCompositions[slide.id], brandLogoAsset, brandLogoPosition, slideTextFlows[slide.id], textLayouts[slide.id])
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(deck.title)}</title>
  <style>
    ${createFontFaceCss()}
    ${baseSlideCss}
    :root { ${theme.css} }
  </style>
</head>
<body>
  <main class="deck" aria-label="${escapeHtml(deck.title)}">
    ${slides}
  </main>
  <script id="ai-ppt-speaker-notes" type="application/json">${escapeScriptJson(
    JSON.stringify({ speakerNotes, slideIntents, slideRevealPlans })
  )}</script>
  <script>
    ${runtimeScript}
  </script>
</body>
</html>`;
}

export function renderExportSlide(
  slide: Slide,
  compositionOverride?: SlideCompositionMap[string],
  brandLogoAsset?: DeckAsset,
  brandLogoPosition: BrandLogoPosition = "top-right",
  textFlow: SlideTextFlowMode = "auto",
  textLayout: SlideTextLayout = {}
): string {
  const annotatedHtml = annotateRevealItems(slide.html);
  const textBlocksHtml = renderTextBlocks(removeFreeImageFrames(annotatedHtml), textLayout, textFlow);
  const freeImageHtml = extractFreeImageFrames(annotatedHtml);
  const composition = getSlideComposition(slide, compositionOverride);
  const revealCount = countRevealItems(annotatedHtml);
  const logoClass = brandLogoAsset?.dataUrl ? ` slide--logo-${brandLogoPosition}` : "";
  const logoHtml = brandLogoAsset?.dataUrl
    ? `<img class="slide-logo slide-logo--${brandLogoPosition}" src="${brandLogoAsset.dataUrl}" alt="${escapeHtml(brandLogoAsset.name)}" />`
    : "";
  return `<section class="slide slide--${slide.layout} slide-composition--${composition}${logoClass}" data-slide-index="${slide.index}" data-reveal-count="${revealCount}" data-reveal-step="0" aria-label="${escapeHtml(slide.title)}">
  <div class="slide__number">${String(slide.index + 1).padStart(2, "0")}</div>
  ${logoHtml}
  <div class="slide__content">${textBlocksHtml.content}</div>
  ${textBlocksHtml.free ? `<div class="slide__text-layer">${textBlocksHtml.free}</div>` : ""}
  ${freeImageHtml ? `<div class="slide__image-layer">${freeImageHtml}</div>` : ""}
</section>`;
}

export const baseSlideCss = `
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--slide-bg); color: var(--slide-ink); }
body { font-family: var(--slide-font-body); overflow: hidden; }
.deck { width: 100vw; height: 100vh; position: relative; }
.slide {
  position: absolute;
  inset: 0;
  display: none;
  width: 100vw;
  height: 100vh;
  padding: clamp(42px, 5.2vw, 76px);
  background:
    var(--slide-bg-detail, linear-gradient(90deg, var(--slide-rule) 1px, transparent 1px) 0 0 / 25% 100%),
    var(--slide-bg-base, var(--slide-surface));
  overflow: hidden;
}
.slide::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--slide-bg-wash, linear-gradient(135deg, transparent 0 72%, color-mix(in srgb, var(--slide-accent) 8%, transparent) 72% 100%));
  opacity: 0.72;
  pointer-events: none;
}
.slide.is-active { display: grid; }
@keyframes pptTextIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pptImageIn {
  from { opacity: 0; filter: blur(8px); }
  to { opacity: 1; filter: blur(0); }
}
.slide__number { position: absolute; top: 28px; right: 34px; color: var(--slide-muted); font-size: 14px; letter-spacing: 0.08em; }
.slide--logo-top-right .slide__number { left: 34px; right: auto; }
.slide-logo {
  position: absolute;
  top: 26px;
  z-index: 3;
  width: auto;
  height: clamp(28px, 3.4vw, 38px);
  max-width: min(14vw, 132px);
  max-height: none;
  object-fit: contain;
  border-radius: 0;
  box-shadow: none;
}
.slide-logo--top-left { left: 34px; }
.slide-logo--top-right { right: 34px; }
.slide__content {
  position: relative;
  z-index: 1;
  align-self: center;
  max-width: min(1180px, 100%);
  width: 100%;
  max-height: calc(100vh - 112px);
  overflow: visible;
}
.slide-text-flow {
  display: grid;
  gap: 14px 28px;
  align-items: start;
  width: 100%;
}
.slide-text-flow--auto { display: block; }
.slide-text-flow--one { grid-template-columns: minmax(0, 1fr); }
.slide-text-flow--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.slide-text-flow--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.slide-text-flow--grid { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: stretch; }
.slide-text-flow .slide-text-block--content { display: block; }
.slide-text-flow--grid .slide-text-block--content { min-height: 118px; padding: 22px 24px; border: 1px solid color-mix(in srgb, var(--slide-rule) 70%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--slide-surface) 78%, transparent); box-shadow: 0 16px 42px rgba(17, 29, 25, 0.08); }
.slide-text-block--content :is(ul, ol) { margin-top: 0; }
.slide-text-block { display: contents; }
.slide__text-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.slide__text-layer .slide-text-block { pointer-events: auto; }
.slide-text-block[data-text-layout="free"] {
  position: absolute;
  left: var(--text-x);
  top: var(--text-y);
  display: block;
  width: var(--text-w, min(90%, 980px));
  max-width: min(90%, 980px);
  transform: translate(-50%, -50%);
  z-index: 3;
}
.slide-text-block[data-text-layout="free"] > :is(h1, h2, h3, p, ul, ol) {
  max-width: 100%;
}
.slide-text-block[data-text-style="custom"][style*="--text-font-family"] > * { font-family: var(--text-font-family); }
.slide-text-block[data-text-style="custom"][style*="--text-font-size"] > * { font-size: var(--text-font-size); }
.slide-text-block[data-text-style="custom"][style*="--text-color"] > * { color: var(--text-color); }
.slide-text-block[data-text-style="custom"][style*="--text-font-weight"] > * { font-weight: var(--text-font-weight); }
.slide-text-block[data-text-style="custom"][style*="--text-line-height"] :is(h1, h2, h3, p, li) { line-height: var(--text-line-height); }
.slide-text-block[data-text-style="custom"][style*="--text-line-height"] :is(ul, ol) { gap: var(--text-list-gap); }
.slide-text-block[data-text-style="custom"][style*="--text-letter-spacing"] :is(h1, h2, h3, p, li) { letter-spacing: var(--text-letter-spacing); }
.slide__image-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.slide__image-layer .slide-image-frame { pointer-events: auto; }
h1, h2, h3 { margin: 0 0 0.42em; font-family: var(--slide-font-title); line-height: 0.98; letter-spacing: 0; }
h1 { font-size: clamp(54px, 6.6vw, 104px); max-width: 12ch; }
h2 { font-size: clamp(36px, 4.6vw, 70px); max-width: 18ch; }
h3 { font-size: clamp(26px, 3vw, 42px); }
p, li {
  font-size: clamp(22px, 2vw, 30px);
  line-height: 1.28;
  overflow-wrap: break-word;
  word-break: normal;
}
p { max-width: 34em; color: var(--slide-muted); }
ul, ol {
  display: grid;
  gap: 0.42em;
  margin: 0.85em 0 0;
  padding-left: 1.1em;
  max-width: min(980px, 100%);
}
li::marker { color: var(--slide-accent); }
a { color: var(--slide-accent); }
blockquote { border-left: 6px solid var(--slide-accent); margin: 0; padding-left: 28px; color: var(--slide-muted); }
pre { background: var(--slide-code-bg); color: var(--slide-code-ink); border-radius: 8px; padding: 28px; overflow: auto; max-height: 58vh; font-size: clamp(16px, 1.6vw, 22px); }
code { font-family: "SF Mono", Menlo, monospace; }
img { max-width: min(760px, 100%); max-height: 58vh; object-fit: cover; border-radius: 6px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22); }
.reveal-item.is-hidden {
  opacity: 0;
  visibility: hidden;
}
.reveal-item.is-revealed {
  visibility: visible;
  opacity: 1;
}
.reveal-item.is-current {
  animation: pptTextIn 560ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
.slide-image-frame.reveal-item.is-current {
  animation-name: pptImageIn;
}
@media (prefers-reduced-motion: reduce) {
  .reveal-item.is-current {
    transform: none;
    animation: none;
  }
}
.slide-image-frame { display: inline-block; position: relative; line-height: 0; }
.slide-image-frame img { display: block; }
.slide-image-frame[data-image-layout="free"] {
  position: absolute;
  left: var(--image-x);
  top: var(--image-y);
  width: var(--image-w);
  transform: translate(-50%, -50%);
}
.slide-image-frame[data-image-layout="free"] img { width: 100%; max-width: none; max-height: none; }
.image-resize-handle { display: none; }
table { border-collapse: collapse; width: min(100%, 980px); font-size: clamp(18px, 1.6vw, 26px); }
td, th { border-bottom: 1px solid var(--slide-rule); padding: 16px 18px; text-align: left; }
th { color: var(--slide-accent); }
.slide--cover .slide__content { align-self: end; padding-bottom: 8vh; }
.slide--cover p { color: var(--slide-accent); font-weight: 700; }
.slide--bullets .slide__content,
.slide--process-steps .slide__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  max-width: min(1040px, 100%);
}
.slide--bullets ul,
.slide--bullets ol,
.slide--process-steps ul,
.slide--process-steps ol {
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  column-gap: 54px;
  row-gap: 0.48em;
}
.slide--bullets li,
.slide--process-steps li { max-width: 24em; }
.slide--image-hero .slide__content { display: grid; grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr); gap: 48px; align-items: center; }
.slide--image-hero img { grid-column: 2; grid-row: 1 / span 4; width: 100%; max-height: 64vh; }
.slide--image-hero .slide-image-frame { grid-column: 2; grid-row: 1 / span 4; width: 100%; }
.slide--image-hero .slide-image-frame img { width: 100%; max-height: 64vh; }
.slide--image-hero .slide-image-frame[data-image-layout="free"] { width: var(--image-w); }
.slide--code .slide__content { max-width: 1180px; }
.slide--section-divider { background: var(--slide-ink); color: var(--slide-surface); }
.slide--section-divider .slide__number, .slide--section-divider p { color: color-mix(in srgb, var(--slide-surface) 72%, transparent); }
.slide-composition--cover-stage { align-items: end; justify-items: start; }
.slide-composition--cover-stage .slide__content { width: min(78%, 900px); transform: translateY(-2%); }
.slide-composition--left-heavy { align-items: center; justify-items: start; }
.slide-composition--left-heavy .slide__content { width: min(70%, 860px); margin-left: 1%; }
.slide-composition--right-heavy { align-items: center; justify-items: end; }
.slide-composition--right-heavy .slide__content { width: min(68%, 820px); margin-right: 2%; }
.slide-composition--right-heavy h1,
.slide-composition--right-heavy h2,
.slide-composition--right-heavy p { margin-left: auto; text-align: right; }
.slide-composition--right-heavy ul,
.slide-composition--right-heavy ol { margin-left: auto; }
.slide-composition--center-stage { align-items: center; justify-items: center; text-align: center; }
.slide-composition--center-stage .slide__content { width: min(82%, 980px); }
.slide-composition--center-stage h1,
.slide-composition--center-stage h2,
.slide-composition--center-stage p,
.slide-composition--center-stage ul,
.slide-composition--center-stage ol { margin-left: auto; margin-right: auto; }
.slide-composition--split-panel .slide__content { width: 100%; display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: clamp(28px, 4vw, 64px); align-items: center; }
.slide-composition--split-panel h1,
.slide-composition--split-panel h2 { grid-column: 1; max-width: 11ch; }
.slide-composition--split-panel p,
.slide-composition--split-panel ul,
.slide-composition--split-panel ol,
.slide-composition--split-panel pre,
.slide-composition--split-panel .slide-text-flow { grid-column: 2; margin-top: 0; }
.slide-composition--poster-bottom { align-items: end; justify-items: start; }
.slide-composition--poster-bottom .slide__content { width: 100%; padding-bottom: 3%; }
.slide-composition--poster-bottom h1,
.slide-composition--poster-bottom h2 { max-width: 15ch; font-size: clamp(46px, 5.6vw, 90px); }
.slide-composition--section-band { align-items: center; justify-items: center; text-align: center; }
.slide-composition--section-band::before { background: linear-gradient(90deg, transparent 0 16%, color-mix(in srgb, var(--slide-accent) 88%, var(--slide-surface)) 16% 18%, transparent 18% 100%); }
.slide-composition--section-band .slide__content { width: min(76%, 920px); }
.slide-composition--section-band h1,
.slide-composition--section-band h2 { max-width: none; font-size: clamp(52px, 6.4vw, 106px); }
.slide-composition--code-lab .slide__content { width: 100%; display: grid; grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr); gap: 34px; align-items: start; }
.slide-composition--code-lab h1,
.slide-composition--code-lab h2 { grid-column: 1; max-width: 9ch; font-size: clamp(38px, 3.8vw, 64px); }
.slide-composition--code-lab pre { grid-column: 2; width: 100%; max-height: 70vh; }
.slide-composition--image-left .slide__content,
.slide-composition--image-right .slide__content { width: 100%; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr); gap: clamp(28px, 4vw, 64px); align-items: center; }
.slide-composition--image-left .slide__content { grid-template-columns: minmax(0, 0.96fr) minmax(0, 1.04fr); }
.slide-composition--image-left .slide-image-frame,
.slide-composition--image-left img { grid-column: 1; grid-row: 1 / span 4; }
.slide-composition--image-left h1,
.slide-composition--image-left h2,
.slide-composition--image-left h3,
.slide-composition--image-left p,
.slide-composition--image-left ul,
.slide-composition--image-left ol { grid-column: 2; }
.slide-composition--image-right .slide-image-frame,
.slide-composition--image-right img { grid-column: 2; grid-row: 1 / span 4; }
.slide-composition--image-right h1,
.slide-composition--image-right h2,
.slide-composition--image-right h3,
.slide-composition--image-right p,
.slide-composition--image-right ul,
.slide-composition--image-right ol { grid-column: 1; }
.slide-composition--image-left .slide-image-frame,
.slide-composition--image-right .slide-image-frame { width: 100%; }
.slide-composition--image-left img,
.slide-composition--image-right img { width: 100%; max-width: none; max-height: 72vh; }
.slide-composition--image-full-bleed { padding: 0; align-items: stretch; }
.slide-composition--image-full-bleed .slide__content { width: 100%; height: 100%; display: grid; grid-template-rows: 1fr auto; max-height: none; }
.slide-composition--image-full-bleed .slide-image-frame,
.slide-composition--image-full-bleed img { grid-row: 1 / -1; grid-column: 1; width: 100%; height: 100%; max-width: none; max-height: none; border-radius: 0; }
.slide-composition--image-full-bleed h1,
.slide-composition--image-full-bleed h2,
.slide-composition--image-full-bleed p,
.slide-composition--image-full-bleed ul,
.slide-composition--image-full-bleed ol { grid-column: 1; z-index: 1; margin: 0 clamp(42px, 5vw, 82px) clamp(42px, 5vw, 76px); color: var(--slide-surface); text-shadow: 0 3px 22px rgba(0, 0, 0, 0.52); }
.slide-composition--image-full-bleed h1,
.slide-composition--image-full-bleed h2 { align-self: end; }
`;

function extractFreeImageFrames(html: string): string {
  return (
    html
      .match(
        /<span\b(?=[^>]*\bslide-image-frame\b)(?=[^>]*\bdata-image-layout="free")[^>]*><img[^>]*><span class="image-resize-handle" aria-hidden="true"><\/span><\/span>/g
      )
      ?.join("") ?? ""
  );
}

function removeFreeImageFrames(html: string): string {
  return html.replace(
    /<span\b(?=[^>]*\bslide-image-frame\b)(?=[^>]*\bdata-image-layout="free")[^>]*><img[^>]*><span class="image-resize-handle" aria-hidden="true"><\/span><\/span>/g,
    ""
  );
}

function renderTextBlocks(html: string, textLayout: SlideTextLayout, textFlow: SlideTextFlowMode): { content: string; free: string } {
  const blocks = splitSlideTextBlocks(html);
  const bodyLayoutBlocksFlow = textFlow !== "auto";
  const hasLegacyBodyLayout = Boolean(textLayout.body && !bodyLayoutBlocksFlow);
  const contentBlocks = blocks.bodyBlocks
    .filter((block) => !hasLegacyBodyLayout && !isFreeTextLayout(textLayout.blocks?.[block.id]))
    .map((block) => renderTextBlock(block.id, block.html, textLayout.blocks?.[block.id], "body", ` slide-text-block--content slide-text-block--${block.kind}`))
    .join("");
  const freeBlocks = blocks.bodyBlocks
    .filter((block) => isFreeTextLayout(textLayout.blocks?.[block.id]))
    .map((block) => renderTextBlock(block.id, block.html, textLayout.blocks?.[block.id], "body", ` slide-text-block--${block.kind}`))
    .join("");
  return {
    content: [
      blocks.titleHtml && !isFreeTextLayout(textLayout.title) ? renderTextBlock("title", blocks.titleHtml, textLayout.title) : "",
      contentBlocks ? `<div class="slide-text-flow slide-text-flow--${textFlow}">${contentBlocks}</div>` : ""
    ].join(""),
    free: [
      blocks.titleHtml && isFreeTextLayout(textLayout.title) ? renderTextBlock("title", blocks.titleHtml, textLayout.title) : "",
      freeBlocks,
      blocks.bodyHtml && textLayout.body && !bodyLayoutBlocksFlow ? renderTextBlock("body", blocks.bodyHtml, textLayout.body) : ""
    ].join("")
  };
}

function renderTextBlock(block: string, html: string, layout?: TextBlockLayout, classBlock: "title" | "body" = block === "title" ? "title" : "body", extraClass = ""): string {
  const styleAttrs = layout ? renderTextBlockStyle(layout) : "";
  const layoutAttrs = layout
    ? `${isFreeTextLayout(layout) ? ` data-text-layout="free"` : ""}${layout.style ? ` data-text-style="custom"` : ""} style="${styleAttrs}"`
    : "";
  return `<div class="slide-text-block slide-text-block--${classBlock}${extraClass}" data-text-block="${block}"${layoutAttrs}>${html}</div>`;
}

function renderTextBlockStyle(layout: TextBlockLayout): string {
  return [
    isFreeTextLayout(layout) ? `--text-x:${layout.x}%` : "",
    isFreeTextLayout(layout) ? `--text-y:${layout.y}%` : "",
    isFreeTextLayout(layout) && layout.width !== undefined ? `--text-w:${layout.width}%` : "",
    layout.style?.fontSize === undefined ? "" : `--text-font-size:${layout.style.fontSize}px`,
    layout.style?.fontFamily === undefined ? "" : `--text-font-family:${layout.style.fontFamily}`,
    layout.style?.color === undefined ? "" : `--text-color:${layout.style.color}`,
    layout.style?.bold === undefined ? "" : `--text-font-weight:${layout.style.bold ? "800" : "400"}`,
    layout.style?.lineHeight === undefined ? "" : `--text-line-height:${layout.style.lineHeight}`,
    layout.style?.lineHeight === undefined ? "" : `--text-list-gap:${Math.max(layout.style.lineHeight * 8, 4)}px`,
    layout.style?.letterSpacing === undefined ? "" : `--text-letter-spacing:${layout.style.letterSpacing}px`
  ]
    .filter(Boolean)
    .join(";");
}

function isFreeTextLayout(layout: TextBlockLayout | undefined): layout is TextBlockLayout {
  return layout?.mode === "free";
}

const runtimeScript = `
let current = 0;
const slides = Array.from(document.querySelectorAll(".slide"));
function getRevealItems(slide) {
  return Array.from(slide.querySelectorAll("[data-reveal-index]"))
    .sort((a, b) => Number(a.dataset.revealIndex) - Number(b.dataset.revealIndex));
}
function setRevealStep(slide, step) {
  const items = getRevealItems(slide);
  const revealStep = Math.max(0, Math.min(step, Math.max(items.length - 1, 0)));
  slide.dataset.revealStep = String(revealStep);
  slide.dataset.revealCount = String(items.length);
  items.forEach((item, itemIndex) => {
    const isRevealed = itemIndex <= revealStep;
    item.classList.toggle("is-hidden", !isRevealed);
    item.classList.toggle("is-revealed", isRevealed);
    item.classList.toggle("is-current", itemIndex === revealStep);
  });
}
function showSlide(index, revealStep = 0) {
  current = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    const isActive = slideIndex === current;
    slide.classList.toggle("is-active", isActive);
    if (isActive) setRevealStep(slide, revealStep);
  });
}
function advanceRevealOrSlide() {
  const slide = slides[current];
  const items = getRevealItems(slide);
  const revealStep = Number(slide.dataset.revealStep ?? "0");
  if (items.length > 0 && revealStep < items.length - 1) {
    setRevealStep(slide, revealStep + 1);
    return;
  }
  showSlide(current + 1, 0);
}
function retreatRevealOrSlide() {
  const slide = slides[current];
  const revealStep = Number(slide.dataset.revealStep ?? "0");
  if (revealStep > 0) {
    setRevealStep(slide, revealStep - 1);
    return;
  }
  const previousIndex = Math.max(current - 1, 0);
  const previousCount = getRevealItems(slides[previousIndex]).length;
  showSlide(previousIndex, Math.max(previousCount - 1, 0));
}
window.addEventListener("keydown", (event) => {
  if (["Enter", "ArrowRight", " ", "PageDown"].includes(event.key)) {
    event.preventDefault();
    advanceRevealOrSlide();
  }
  if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    retreatRevealOrSlide();
  }
});
showSlide(0);
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c");
}
