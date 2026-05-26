import type { SlideCompositionMap, SlideMetadataMap, SlideTextFlowMap } from "../markdown/types";

export type DeckScenario = "lesson" | "report" | "training" | "pitch" | "reading";

export interface GenerateOutlineInput {
  topic: string;
  scenario: DeckScenario;
  audience: string;
  slideCount: number;
  tone: string;
  sourceMaterial?: string;
}

export interface GeneratedOutlineSlide {
  id: string;
  title: string;
  bullets: string[];
  purpose: "cover" | "context" | "problem" | "method" | "example" | "summary" | "action";
}

export interface GeneratedOutline {
  title: string;
  subtitle?: string;
  slides: GeneratedOutlineSlide[];
}

export interface GenerateDeckResult {
  markdown: string;
  themeId: string;
  slideCompositions: SlideCompositionMap;
  slideTextFlows?: SlideTextFlowMap;
  speakerNotes?: Record<string, string>;
  slideIntents?: SlideMetadataMap;
  revealPlan?: SlideMetadataMap;
}

export async function generateOutline(input: GenerateOutlineInput): Promise<GeneratedOutline> {
  const response = await fetch("/api/generate-outline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const data = (await response.json().catch(() => ({}))) as Partial<GeneratedOutline> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "AI 大纲生成失败。");
  }

  if (!isGeneratedOutline(data)) {
    throw new Error("AI 返回的大纲格式不完整，可以重试一次，或减少资料长度。");
  }

  return data;
}

export async function generateDeck(input: GenerateOutlineInput, outline: GeneratedOutline): Promise<GenerateDeckResult> {
  const response = await fetch("/api/generate-deck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ input, outline })
  });

  const data = (await response.json().catch(() => ({}))) as Partial<GenerateDeckResult> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "AI PPT 生成失败。");
  }

  if (typeof data.markdown !== "string" || data.markdown.trim().length === 0 || typeof data.themeId !== "string") {
    throw new Error("AI 返回的 PPT 内容不完整，可以重试一次。");
  }

  return {
    markdown: data.markdown,
    themeId: data.themeId,
    slideCompositions: isRecord(data.slideCompositions) ? (data.slideCompositions as SlideCompositionMap) : {},
    slideTextFlows: isRecord(data.slideTextFlows) ? (data.slideTextFlows as SlideTextFlowMap) : undefined,
    speakerNotes: isRecord(data.speakerNotes) ? (data.speakerNotes as Record<string, string>) : undefined,
    slideIntents: isRecord(data.slideIntents) ? (data.slideIntents as SlideMetadataMap) : undefined,
    revealPlan: isRecord(data.revealPlan) ? (data.revealPlan as SlideMetadataMap) : undefined
  };
}

function isGeneratedOutline(value: unknown): value is GeneratedOutline {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    Array.isArray(value.slides) &&
    value.slides.length > 0 &&
    value.slides.every(isGeneratedOutlineSlide)
  );
}

function isGeneratedOutlineSlide(value: unknown): value is GeneratedOutlineSlide {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.bullets) &&
    value.bullets.every((item) => typeof item === "string") &&
    isSlidePurpose(value.purpose)
  );
}

function isSlidePurpose(value: unknown): value is GeneratedOutlineSlide["purpose"] {
  return value === "cover" || value === "context" || value === "problem" || value === "method" || value === "example" || value === "summary" || value === "action";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
