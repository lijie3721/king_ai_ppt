export const maxImageSizeMb = 3;

import type { DeckAsset } from "../markdown/types";

interface BuildImageSlideInput {
  fileName: string;
  assetId: string;
}

interface BuildImageAssetInput {
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
  now?: number;
}

interface InsertImageInput {
  source: string;
  insertText: string;
  selectionStart?: number;
  selectionEnd?: number;
}

interface InsertImageIntoSlideInput {
  source: string;
  slideIndex: number;
  insertText: string;
}

export function buildImageAsset({
  fileName,
  dataUrl,
  sizeBytes,
  now = Date.now()
}: BuildImageAssetInput): DeckAsset {
  return {
    id: createAssetId(fileName, now),
    name: fileName,
    mimeType: extractMimeType(dataUrl),
    dataUrl,
    sizeBytes,
    createdAt: now
  };
}

export function buildImageSlideMarkdown({ fileName, assetId }: BuildImageSlideInput): string {
  const alt = fileNameToAlt(fileName);
  return `---\n\n## ${alt}\n\n![${alt}](asset:${assetId})`;
}

export function buildInlineImageMarkdown({ fileName, assetId }: BuildImageSlideInput): string {
  const alt = fileNameToAlt(fileName);
  return `![${alt}](asset:${assetId})`;
}

export function insertImageIntoSlide({
  source,
  slideIndex,
  insertText
}: InsertImageIntoSlideInput): { value: string; cursor: number } {
  const parts = splitSlides(source);
  const targetIndex = Math.min(Math.max(slideIndex, 0), parts.length - 1);
  const inlineImage = stripLeadingDivider(insertText);
  parts[targetIndex] = `${parts[targetIndex].trimEnd()}\n\n${inlineImage}`;
  const value = parts.join("\n\n---\n\n");
  const cursor = parts.slice(0, targetIndex + 1).join("\n\n---\n\n").length;
  return { value, cursor };
}

export function insertImageMarkdown({
  source,
  insertText,
  selectionStart,
  selectionEnd
}: InsertImageInput): { value: string; cursor: number } {
  const canUseSelection =
    typeof selectionStart === "number" &&
    typeof selectionEnd === "number" &&
    selectionStart >= 0 &&
    selectionEnd >= selectionStart &&
    selectionEnd <= source.length;

  if (!canUseSelection) {
    const prefix = source.trimEnd();
    const value = `${prefix}\n\n---\n\n${stripLeadingDivider(insertText)}`;
    return { value, cursor: value.length };
  }

  const before = source.slice(0, selectionStart).trimEnd();
  const after = source.slice(selectionEnd).trimStart();
  const value = `${before}\n\n${insertText}${after ? `\n\n${after}` : ""}`;

  return {
    value,
    cursor: before.length + 2 + insertText.length
  };
}

export function isImageTooLarge(sizeBytes: number, limitMb = maxImageSizeMb): boolean {
  return sizeBytes > limitMb * 1024 * 1024;
}

function fileNameToAlt(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.trim() || "图片页";
}

function stripLeadingDivider(value: string): string {
  return value.replace(/^---\s*/, "").trimStart();
}

function splitSlides(markdown: string): string[] {
  const normalized = markdown.trim();
  if (!normalized) return ["# AI Slides\n\nStart writing your story."];
  const parts = normalized
    .split(/\n\s*---\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [normalized];
}

function extractMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return match?.[1] || "application/octet-stream";
}

function createAssetId(fileName: string, now: number): string {
  const base = fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return `img_${base || "image"}_${now.toString(36)}`;
}
