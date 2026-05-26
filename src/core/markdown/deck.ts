import { marked } from "marked";
import type { Deck, DeckAsset, ImageLayoutMap, Slide, SlideLayout } from "./types";

marked.setOptions({
  gfm: true,
  breaks: true
});

export function parseMarkdownDeck(
  markdown: string,
  assets: DeckAsset[] = [],
  imageLayouts: ImageLayoutMap = {}
): Deck {
  const rawSlides = splitSlides(markdown);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const slides = rawSlides.map((slideMarkdown, index) => {
    const title = extractTitle(slideMarkdown) || `Slide ${index + 1}`;
    const layout = inferLayout(slideMarkdown, index);
    const imageAssetIds = extractAssetImageIds(slideMarkdown);
    const html = unwrapStandaloneImageFrames(
      resolveAssetImages(sanitizeHtml(marked.parse(slideMarkdown, { async: false }) as string), assetMap, imageLayouts)
    );

    return {
      id: `slide-${index + 1}`,
      index,
      markdown: slideMarkdown,
      html,
      title,
      layout,
      imageAssetIds
    } satisfies Slide;
  });

  return {
    title: slides[0]?.title ?? "Untitled Deck",
    slides
  };
}

function splitSlides(markdown: string): string[] {
  const normalized = markdown.trim();
  if (!normalized) {
    return ["# AI Slides\n\nStart writing your story."];
  }

  const parts = normalized
    .split(/\n\s*---\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}

function extractTitle(markdown: string): string {
  const heading = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (!heading) return "";
  return heading[1].replace(/[*_`]/g, "").trim();
}

function extractAssetImageIds(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*]\(asset:([^)]+)\)/g)].map((match) => match[1]);
}

function inferLayout(markdown: string, index: number): SlideLayout {
  const trimmed = markdown.trim();
  const headingCount = (trimmed.match(/^#{1,3}\s+/gm) ?? []).length;
  const hasCode = /```[\s\S]*?```/.test(trimmed);
  const hasImage = /!\[[^\]]*]\([^)]+\)/.test(trimmed);
  const listItems = (trimmed.match(/^\s*[-*+]\s+/gm) ?? []).length;
  const hasColumns = /\n\s*\|\s*.+\s*\|\s*\n\s*\|[-:\s|]+\|/.test(trimmed);
  const isThanks = /\b(thanks|thank you|谢谢|感谢)\b/i.test(trimmed);

  if (isThanks) return "thanks";
  if (index === 0 && /^#\s+/.test(trimmed)) return "cover";
  if (hasCode) return "code";
  if (hasImage) return "image-hero";
  if (hasColumns) return "comparison";
  if (listItems >= 5) return "process-steps";
  if (listItems >= 2) return "bullets";
  if (headingCount === 1 && /^##\s+/.test(trimmed) && trimmed.length < 90) {
    return "section-divider";
  }
  return "two-column";
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)="javascript:[^"]*"/gi, "")
    .replace(/\s(href|src)='javascript:[^']*'/gi, "");
}

function resolveAssetImages(
  html: string,
  assets: Map<string, DeckAsset>,
  imageLayouts: ImageLayoutMap
): string {
  return html.replace(
    /<img([^>]*?)src="asset:([^"]+)"([^>]*?)alt="([^"]*)"([^>]*)>/gi,
    (_match, before, assetId, middle, alt, after) => {
      const normalizedAssetId = decodeAssetId(assetId);
      const asset = assets.get(normalizedAssetId);
      if (!asset) {
        return `<span class="missing-image" role="note">Missing image: ${escapeHtml(alt || normalizedAssetId)}</span>`;
      }
      const layout = imageLayouts[normalizedAssetId];
      const layoutAttrs = layout
        ? ` data-image-layout="free" style="--image-x:${layout.x}%;--image-y:${layout.y}%;--image-w:${layout.width}%"`
        : "";
      return `<span class="slide-image-frame" data-asset-id="${escapeHtml(normalizedAssetId)}"${layoutAttrs}><img${before}src="${asset.dataUrl}"${middle}alt="${escapeHtml(alt)}"${after}><span class="image-resize-handle" aria-hidden="true"></span></span>`;
    }
  );
}

function unwrapStandaloneImageFrames(html: string): string {
  return html.replace(
    /<p>\s*(<span class="slide-image-frame"[^>]*>[\s\S]*?<\/span>)\s*<\/p>/g,
    (_match, imageFrame) => imageFrame
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeAssetId(assetId: string): string {
  try {
    return decodeURIComponent(assetId);
  } catch {
    return assetId;
  }
}
