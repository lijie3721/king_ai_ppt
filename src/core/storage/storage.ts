import type {
  BrandLogo,
  DeckAsset,
  DeckAssetMeta,
  ImageLayoutMap,
  SlideCompositionMap,
  SlideMetadataMap,
  SlideTextFlowMap,
  SlideTextFlowMode,
  TextLayoutMap
} from "../markdown/types";
import { isSlideComposition } from "../presentation/slideComposition";
import { loadAssets, saveAssets } from "./assetStore";

export interface DraftState {
  markdown: string;
  themeId: string;
  assets: DeckAsset[];
  imageLayouts: ImageLayoutMap;
  slideCompositions: SlideCompositionMap;
  slideTextFlows: SlideTextFlowMap;
  textLayouts: TextLayoutMap;
  speakerNotes?: SlideMetadataMap;
  slideIntents?: SlideMetadataMap;
  slideRevealPlans?: SlideMetadataMap;
  brandLogo?: BrandLogo;
}

export interface StoredDraftState {
  markdown: string;
  themeId: string;
  assets: DeckAssetMeta[];
  imageLayouts: ImageLayoutMap;
  slideCompositions: SlideCompositionMap;
  slideTextFlows: SlideTextFlowMap;
  textLayouts: TextLayoutMap;
  speakerNotes?: SlideMetadataMap;
  slideIntents?: SlideMetadataMap;
  slideRevealPlans?: SlideMetadataMap;
  brandLogo?: BrandLogo;
}

const storageKey = "ai-ppt:draft";
const documentLibraryKey = "ai-ppt:documents";
const activeDocumentKey = "ai-ppt:active-document";

export interface PptDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  draft: DraftState;
  estimatedSizeBytes: number;
}

interface StoredPptDocument {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  draft: StoredDraftState;
  estimatedSizeBytes?: number;
}

export interface DocumentLibrary {
  activeDocumentId: string;
  documents: PptDocument[];
}

export const defaultMarkdown = `# AI Slides

Turn Markdown into a lecture-ready HTML deck.

---

## What changes

- Write in Markdown
- Preview live slides
- Switch visual systems
- Export one offline HTML file

---

## Code friendly

\`\`\`ts
const deck = parseMarkdownDeck(markdown);
exportHtml(deck);
\`\`\`

---

## Thanks

Ready to teach.`;

export const defaultDraft: DraftState = {
  markdown: defaultMarkdown,
  themeId: "business-report",
  assets: [],
  imageLayouts: {},
  slideCompositions: {},
  slideTextFlows: {},
  textLayouts: {},
  speakerNotes: {},
  slideIntents: {},
  slideRevealPlans: {},
  brandLogo: undefined
};

export function loadDraft(): DraftState {
  const library = loadStoredDocumentLibrary();
  if (library) {
    return library.documents.find((document) => document.id === library.activeDocumentId)?.draft ?? library.documents[0]?.draft ?? defaultDraft;
  }
  return loadLegacyDraft();
}

function loadLegacyDraft(): DraftState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultDraft;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    if (typeof parsed.markdown !== "string" || typeof parsed.themeId !== "string") {
      return defaultDraft;
    }
    const existingAssets = Array.isArray(parsed.assets) ? parsed.assets.filter(isStoredDeckAsset).map(toDraftAsset) : [];
    const imageLayouts = isImageLayoutMap(parsed.imageLayouts) ? parsed.imageLayouts : {};
    const slideCompositions = parseSlideCompositionMap(parsed.slideCompositions);
    const slideTextFlows = parseSlideTextFlowMap(parsed.slideTextFlows);
    const textLayouts = parseTextLayoutMap(parsed.textLayouts);
    const speakerNotes = parseSlideMetadataMap(parsed.speakerNotes);
    const slideIntents = parseSlideMetadataMap(parsed.slideIntents);
    const slideRevealPlans = parseSlideMetadataMap(parsed.slideRevealPlans);
    const brandLogo = parseBrandLogo(parsed.brandLogo);
    const migrated = migrateInlineDataImages(parsed.markdown, existingAssets);
    return {
      markdown: migrated.markdown,
      themeId: parsed.themeId,
      assets: migrated.assets,
      imageLayouts,
      slideCompositions,
      slideTextFlows,
      textLayouts,
      speakerNotes,
      slideIntents,
      slideRevealPlans,
      brandLogo
    };
  } catch {
    return defaultDraft;
  }
}

export function loadDocumentLibrary(): DocumentLibrary {
  const stored = loadStoredDocumentLibrary();
  if (stored) return stored;
  const migratedDraft = loadLegacyDraft();
  const document = createDocumentFromDraft(migratedDraft, extractDraftTitle(migratedDraft), Date.now());
  const library = {
    activeDocumentId: document.id,
    documents: [document]
  };
  saveDocumentLibrary(library);
  return library;
}

export function createDocument(title = "未命名课件"): PptDocument {
  const library = loadDocumentLibrary();
  const now = Date.now();
  const draft: DraftState = {
    ...defaultDraft,
    markdown: `# ${title || "未命名课件"}`
  };
  const document = createDocumentFromDraft(draft, title || extractDraftTitle(draft), now);
  saveDocumentLibrary({
    activeDocumentId: document.id,
    documents: [...library.documents, document]
  });
  return document;
}

export function createDocumentWithDraft(title: string, draft: DraftState): PptDocument {
  const library = loadDocumentLibrary();
  const document = createDocumentFromDraft(draft, title || extractDraftTitle(draft), Date.now());
  saveDocumentLibrary({
    activeDocumentId: document.id,
    documents: [...library.documents, document]
  });
  return document;
}

export function saveActiveDocument(draft: DraftState): boolean {
  const library = loadDocumentLibrary();
  const now = Date.now();
  const documents = library.documents.map((document) =>
    document.id === library.activeDocumentId
      ? {
          ...document,
          title: extractDraftTitle(draft),
          updatedAt: now,
          draft,
          estimatedSizeBytes: estimateDraftSize(draft)
        }
      : document
  );
  return saveDocumentLibrary({ ...library, documents });
}

export function setActiveDocument(documentId: string): boolean {
  const library = loadDocumentLibrary();
  if (!library.documents.some((document) => document.id === documentId)) return false;
  return saveDocumentLibrary({ ...library, activeDocumentId: documentId });
}

export function renameDocument(documentId: string, title: string): boolean {
  const trimmedTitle = title.trim() || "未命名课件";
  const library = loadDocumentLibrary();
  return saveDocumentLibrary({
    ...library,
    documents: library.documents.map((document) => (document.id === documentId ? { ...document, title: trimmedTitle, updatedAt: Date.now() } : document))
  });
}

export function duplicateDocument(documentId: string): PptDocument | undefined {
  const library = loadDocumentLibrary();
  const source = library.documents.find((document) => document.id === documentId);
  if (!source) return undefined;
  const document = createDocumentFromDraft(source.draft, `${source.title} 副本`, Date.now());
  saveDocumentLibrary({
    activeDocumentId: document.id,
    documents: [...library.documents, document]
  });
  return document;
}

export function deleteDocument(documentId: string): boolean {
  const library = loadDocumentLibrary();
  if (library.documents.length <= 1) return false;
  const documents = library.documents.filter((document) => document.id !== documentId);
  const activeDocumentId = library.activeDocumentId === documentId ? documents[0].id : library.activeDocumentId;
  return saveDocumentLibrary({ activeDocumentId, documents });
}

export function buildProjectExport(draft: DraftState, title = extractDraftTitle(draft)): string {
  return JSON.stringify(
    {
      version: 1,
      title,
      exportedAt: Date.now(),
      draft
    },
    null,
    2
  );
}

export function importProjectExport(raw: string): PptDocument {
  const parsed = JSON.parse(raw) as { title?: unknown; draft?: unknown };
  const draft = parseDraftLike(parsed.draft);
  if (!draft) {
    throw new Error("Invalid AI PPT project file.");
  }
  const document = createDocumentFromDraft(draft, typeof parsed.title === "string" ? parsed.title : extractDraftTitle(draft), Date.now());
  const library = loadDocumentLibrary();
  saveDocumentLibrary({
    activeDocumentId: document.id,
    documents: [...library.documents, document]
  });
  return document;
}

export async function loadDraftWithAssets(): Promise<DraftState> {
  const draft = loadDraft();
  const inlineAssets = draft.assets.filter((asset) => asset.dataUrl.startsWith("data:image/"));
  if (inlineAssets.length > 0) {
    await saveAssets(inlineAssets);
    saveDraft(draft);
    return draft;
  }

  try {
    return {
      ...draft,
      assets: await loadAssets(draft.assets)
    };
  } catch {
    return draft;
  }
}

export function saveDraft(draft: DraftState): boolean {
  if (loadStoredDocumentLibrary()) {
    return saveActiveDocument(draft);
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(toStoredDraft(draft)));
    return true;
  } catch {
    return false;
  }
}

function loadStoredDocumentLibrary(): DocumentLibrary | undefined {
  try {
    const raw = localStorage.getItem(documentLibraryKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { documents?: unknown; activeDocumentId?: unknown };
    if (!Array.isArray(parsed.documents)) return undefined;
    const documents = parsed.documents.map(parseStoredDocument).filter((document): document is PptDocument => Boolean(document));
    if (documents.length === 0) return undefined;
    const activeDocumentId =
      typeof parsed.activeDocumentId === "string" && documents.some((document) => document.id === parsed.activeDocumentId)
        ? parsed.activeDocumentId
        : documents[0].id;
    return { activeDocumentId, documents };
  } catch {
    return undefined;
  }
}

function saveDocumentLibrary(library: DocumentLibrary): boolean {
  try {
    localStorage.setItem(activeDocumentKey, library.activeDocumentId);
    localStorage.setItem(
      documentLibraryKey,
      JSON.stringify({
        activeDocumentId: library.activeDocumentId,
        documents: library.documents.map(toStoredDocument)
      })
    );
    return true;
  } catch {
    return false;
  }
}

function createDocumentFromDraft(draft: DraftState, title: string, timestamp: number): PptDocument {
  return {
    id: `doc_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || "未命名课件",
    createdAt: timestamp,
    updatedAt: timestamp,
    draft,
    estimatedSizeBytes: estimateDraftSize(draft)
  };
}

function parseStoredDocument(value: unknown): PptDocument | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const document = value as Partial<StoredPptDocument>;
  const draft = parseDraftLike(document.draft);
  if (!draft || typeof document.id !== "string" || typeof document.title !== "string") return undefined;
  const createdAt = typeof document.createdAt === "number" && Number.isFinite(document.createdAt) ? document.createdAt : Date.now();
  const updatedAt = typeof document.updatedAt === "number" && Number.isFinite(document.updatedAt) ? document.updatedAt : createdAt;
  return {
    id: document.id,
    title: document.title,
    createdAt,
    updatedAt,
    draft,
    estimatedSizeBytes: estimateDraftSize(draft)
  };
}

function toStoredDocument(document: PptDocument): StoredPptDocument {
  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    draft: toStoredDraft(document.draft),
    estimatedSizeBytes: estimateDraftSize(document.draft)
  };
}

function parseDraftLike(value: unknown): DraftState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const parsed = value as Partial<DraftState>;
  if (typeof parsed.markdown !== "string" || typeof parsed.themeId !== "string") return undefined;
  const existingAssets = Array.isArray(parsed.assets) ? parsed.assets.filter(isStoredDeckAsset).map(toDraftAsset) : [];
  const migrated = migrateInlineDataImages(parsed.markdown, existingAssets);
  return {
    markdown: migrated.markdown,
    themeId: parsed.themeId,
    assets: migrated.assets,
    imageLayouts: isImageLayoutMap(parsed.imageLayouts) ? parsed.imageLayouts : {},
    slideCompositions: parseSlideCompositionMap(parsed.slideCompositions),
    slideTextFlows: parseSlideTextFlowMap(parsed.slideTextFlows),
    textLayouts: parseTextLayoutMap(parsed.textLayouts),
    speakerNotes: parseSlideMetadataMap(parsed.speakerNotes),
    slideIntents: parseSlideMetadataMap(parsed.slideIntents),
    slideRevealPlans: parseSlideMetadataMap(parsed.slideRevealPlans),
    brandLogo: parseBrandLogo(parsed.brandLogo)
  };
}

export function mergeHydratedAssets(currentDraft: DraftState, loadedDraft: DraftState): DraftState {
  const currentAssets = new Map(currentDraft.assets.map((asset) => [asset.id, asset]));
  const loadedAssets = new Map(loadedDraft.assets.map((asset) => [asset.id, asset]));
  const assetIds = new Set(extractReferencedAssetIds(currentDraft.markdown));
  if (currentDraft.brandLogo) {
    assetIds.add(currentDraft.brandLogo.assetId);
  }
  const assets = [...assetIds]
    .map((assetId) => chooseHydratedAsset(currentAssets.get(assetId), loadedAssets.get(assetId)))
    .filter((asset): asset is DeckAsset => Boolean(asset));

  return {
    ...currentDraft,
    assets
  };
}

function toStoredDraft(draft: DraftState): StoredDraftState {
  return {
    markdown: draft.markdown,
    themeId: draft.themeId,
    assets: draft.assets.map(({ dataUrl: _dataUrl, ...asset }) => asset),
    imageLayouts: draft.imageLayouts,
    slideCompositions: draft.slideCompositions,
    slideTextFlows: draft.slideTextFlows,
    textLayouts: draft.textLayouts,
    speakerNotes: draft.speakerNotes,
    slideIntents: draft.slideIntents,
    slideRevealPlans: draft.slideRevealPlans,
    brandLogo: draft.brandLogo
  };
}

function toDraftAsset(asset: DeckAsset | DeckAssetMeta): DeckAsset {
  return {
    ...asset,
    dataUrl: "dataUrl" in asset && typeof asset.dataUrl === "string" ? asset.dataUrl : ""
  };
}

function isStoredDeckAsset(value: unknown): value is DeckAsset | DeckAssetMeta {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<DeckAsset>;
  return (
    typeof asset.id === "string" &&
    typeof asset.name === "string" &&
    typeof asset.mimeType === "string" &&
    typeof asset.sizeBytes === "number" &&
    typeof asset.createdAt === "number"
  );
}

function isImageLayoutMap(value: unknown): value is ImageLayoutMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([, layout]) => {
    if (!layout || typeof layout !== "object") return false;
    const item = layout as Partial<ImageLayoutMap[string]>;
    return (
      typeof item.x === "number" &&
      typeof item.y === "number" &&
      typeof item.width === "number" &&
      Number.isFinite(item.x) &&
      Number.isFinite(item.y) &&
      Number.isFinite(item.width)
    );
  });
}

function parseSlideCompositionMap(value: unknown): SlideCompositionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([slideId, composition]) => typeof slideId === "string" && isSlideComposition(composition))
  );
}

function parseSlideTextFlowMap(value: unknown): SlideTextFlowMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, SlideTextFlowMode] => typeof entry[0] === "string" && isSlideTextFlowMode(entry[1])
    )
  );
}

function isSlideTextFlowMode(value: unknown): value is SlideTextFlowMode {
  return value === "auto" || value === "one" || value === "two" || value === "three" || value === "grid";
}

function parseTextLayoutMap(value: unknown): TextLayoutMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .map(([slideId, layout]) => {
      if (typeof slideId !== "string" || !layout || typeof layout !== "object" || Array.isArray(layout)) {
        return undefined;
      }
      const item = layout as Partial<TextLayoutMap[string]>;
      const title = parseTextBlockLayout(item.title);
      const body = parseTextBlockLayout(item.body);
      const blocks = parseTextBlockLayoutMap(item.blocks);
      if (!title && !body && !blocks) return undefined;
      return [slideId, { ...(title ? { title } : {}), ...(body ? { body } : {}), ...(blocks ? { blocks } : {}) }] as const;
    })
    .filter((entry): entry is readonly [string, TextLayoutMap[string]] => Boolean(entry));
  return Object.fromEntries(entries);
}

function parseSlideMetadataMap(value: unknown): SlideMetadataMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      .map(([slideId, text]) => [slideId, text.slice(0, 5000)])
  );
}

function parseTextBlockLayoutMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const blocks = Object.fromEntries(
    Object.entries(value)
      .map(([blockId, layout]) => {
        if (typeof blockId !== "string") return undefined;
        const parsed = parseTextBlockLayout(layout);
        return parsed ? ([blockId, parsed] as const) : undefined;
      })
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof parseTextBlockLayout>>] => Boolean(entry))
  );
  return Object.keys(blocks).length > 0 ? blocks : undefined;
}

function parseTextBlockLayout(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const layout = value as { x?: unknown; y?: unknown; width?: unknown; style?: unknown };
  if (typeof layout.x !== "number" || typeof layout.y !== "number") return undefined;
  if (!Number.isFinite(layout.x) || !Number.isFinite(layout.y)) return undefined;
  if (layout.width !== undefined && (typeof layout.width !== "number" || !Number.isFinite(layout.width))) return undefined;
  const style = parseTextBlockStyle(layout.style);
  if (layout.style !== undefined && !style) return undefined;
  return {
    x: layout.x,
    y: layout.y,
    ...(layout.width === undefined ? {} : { width: layout.width }),
    ...(style ? { style } : {})
  };
}

function parseTextBlockStyle(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const style = value as {
    fontSize?: unknown;
    fontFamily?: unknown;
    color?: unknown;
    bold?: unknown;
    lineHeight?: unknown;
    letterSpacing?: unknown;
  };
  const nextStyle: NonNullable<TextLayoutMap[string][keyof TextLayoutMap[string]]>["style"] = {};
  if (style.fontSize !== undefined) {
    if (typeof style.fontSize !== "number" || !Number.isFinite(style.fontSize)) return undefined;
    nextStyle.fontSize = style.fontSize;
  }
  if (style.fontFamily !== undefined) {
    if (typeof style.fontFamily !== "string" || style.fontFamily.length > 80) return undefined;
    nextStyle.fontFamily = style.fontFamily;
  }
  if (style.color !== undefined) {
    if (typeof style.color !== "string" || !/^#[0-9a-f]{6}$/i.test(style.color)) return undefined;
    nextStyle.color = style.color;
  }
  if (style.bold !== undefined) {
    if (typeof style.bold !== "boolean") return undefined;
    nextStyle.bold = style.bold;
  }
  if (style.lineHeight !== undefined) {
    if (typeof style.lineHeight !== "number" || !Number.isFinite(style.lineHeight)) return undefined;
    nextStyle.lineHeight = style.lineHeight;
  }
  if (style.letterSpacing !== undefined) {
    if (typeof style.letterSpacing !== "number" || !Number.isFinite(style.letterSpacing)) return undefined;
    nextStyle.letterSpacing = style.letterSpacing;
  }
  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function parseBrandLogo(value: unknown): BrandLogo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const logo = value as Partial<BrandLogo>;
  if (typeof logo.assetId !== "string") return undefined;
  if (logo.position !== "top-left" && logo.position !== "top-right") return undefined;
  return {
    assetId: logo.assetId,
    position: logo.position
  };
}

function migrateInlineDataImages(markdown: string, assets: DeckAsset[]): {
  markdown: string;
  assets: DeckAsset[];
} {
  const nextAssets = [...assets];
  const migrateMatch = (_match: string, alt: string, dataUrl: string, extension: string) => {
      const nameBase = (alt || "图片页").trim() || "图片页";
      const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
      const id = createMigratedAssetId(nameBase, nextAssets.length);
      nextAssets.push({
        id,
        name: `${nameBase}.${normalizedExtension}`,
        mimeType: `image/${extension}`,
        dataUrl,
        sizeBytes: estimateDataUrlBytes(dataUrl),
        createdAt: Date.now()
      });
      return `![${alt}](asset:${id})`;
    };
  const nextMarkdown = markdown
    .replace(/!\[([^\]]*)\]\((data:image\/([^;,)\s]+)[^)]*)\)/g, migrateMatch)
    .replace(/!\[([^\]]*)\]\s*\n\s*\((data:image\/([^;,)\s]+)[^)]*)\)/g, migrateMatch);

  return {
    markdown: nextMarkdown,
    assets: nextAssets
  };
}

function createMigratedAssetId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return `img_${slug || "image"}_${index + 1}`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function estimateDraftSize(draft: DraftState): number {
  return JSON.stringify(toStoredDraft(draft)).length + draft.assets.reduce((total, asset) => total + asset.sizeBytes, 0);
}

function extractDraftTitle(draft: DraftState): string {
  const heading = draft.markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"));
  return heading?.replace(/^#+\s*/, "").trim() || "未命名课件";
}

function extractReferencedAssetIds(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(/asset:([^\)\s]+)/g)].map((match) => match[1]))];
}

function chooseHydratedAsset(currentAsset: DeckAsset | undefined, loadedAsset: DeckAsset | undefined) {
  if (currentAsset?.dataUrl) return currentAsset;
  if (loadedAsset?.dataUrl) return loadedAsset;
  return currentAsset ?? loadedAsset;
}
