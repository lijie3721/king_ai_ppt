export type SlideLayout =
  | "cover"
  | "section-divider"
  | "bullets"
  | "two-column"
  | "image-hero"
  | "code"
  | "timeline"
  | "comparison"
  | "process-steps"
  | "thanks";

export type SlideComposition =
  | "cover-stage"
  | "section-band"
  | "code-lab"
  | "left-heavy"
  | "right-heavy"
  | "center-stage"
  | "split-panel"
  | "poster-bottom"
  | "image-right"
  | "image-left"
  | "image-full-bleed";

export interface Slide {
  id: string;
  index: number;
  markdown: string;
  html: string;
  title: string;
  layout: SlideLayout;
  imageAssetIds: string[];
}

export interface DeckAsset {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: number;
}

export type DeckAssetMeta = Omit<DeckAsset, "dataUrl">;

export interface ImageLayout {
  x: number;
  y: number;
  width: number;
}

export type ImageLayoutMap = Record<string, ImageLayout>;

export interface TextBlockLayout {
  x: number;
  y: number;
  mode?: "free";
  width?: number;
  style?: TextBlockStyle;
}

export interface TextBlockStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface SlideTextLayout {
  title?: TextBlockLayout;
  body?: TextBlockLayout;
  blocks?: Record<string, TextBlockLayout>;
}

export type TextLayoutMap = Record<string, SlideTextLayout>;

export type SlideCompositionMap = Record<string, SlideComposition>;

export type SlideTextFlowMode = "auto" | "one" | "two" | "three" | "grid";

export type SlideTextFlowMap = Record<string, SlideTextFlowMode>;

export type SlideMetadataMap = Record<string, string>;

export type BrandLogoPosition = "top-left" | "top-right";

export interface BrandLogo {
  assetId: string;
  position: BrandLogoPosition;
}

export interface Deck {
  title: string;
  slides: Slide[];
}
