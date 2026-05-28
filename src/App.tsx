import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Brain,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns2,
  Copy,
  Download,
  FileInput,
  FolderOpen,
  ImagePlus,
  LayoutTemplate,
  MonitorPlay,
  Palette,
  PanelLeft,
  PanelRight,
  Presentation,
  Redo2,
  Save,
  Sparkles,
  Maximize2,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { generateDeck, generateOutline } from "./core/ai/generateDeck";
import type { GenerateOutlineInput, GeneratedOutline, GeneratedOutlineSlide } from "./core/ai/generateDeck";
import {
  buildInlineImageMarkdown,
  buildImageAsset,
  insertImageIntoSlide,
  isImageTooLarge,
  maxImageSizeMb
} from "./core/editor/imageInsert";
import { normalizeImageLayout } from "./core/editor/imageLayout";
import { normalizeTextBlockLayout } from "./core/editor/textLayout";
import { optimizeMarkdown } from "./core/ai/optimizeMarkdown";
import { createStandaloneHtml } from "./core/export/exportDeck";
import { createFontFaceCss, textStyleFonts } from "./core/fonts/fontCatalog";
import { parseMarkdownDeck } from "./core/markdown/deck";
import { getAvailableSlideCompositions, getSlideComposition, isSlideComposition, suggestAlternativeSlideCompositions } from "./core/presentation/slideComposition";
import { beautifyDeckLayout } from "./core/presentation/deckBeautify";
import { annotateRevealItems, countRevealItems } from "./core/presentation/reveal";
import { createSlideAutoLayoutPatch } from "./core/presentation/slideAutoLayout";
import { splitSlideTextBlocks } from "./core/presentation/textBlocks";
import { analyzeSlideHealth } from "./core/presentation/slideHealth";
import { toSlideRect, type SlideMeasure, type SlideMeasuredElement } from "./core/presentation/slideMeasure";
import { deleteAssets, saveAsset, saveAssets } from "./core/storage/assetStore";
import {
  buildProjectExport,
  createDocument,
  createDocumentWithDraft,
  deleteDocument,
  duplicateDocument,
  importProjectExport,
  loadDocumentLibrary,
  loadDraft,
  loadDraftWithAssets,
  mergeHydratedAssets,
  renameDocument,
  saveDraft,
  setActiveDocument,
  defaultDraft
} from "./core/storage/storage";
import { themeList, themes } from "./core/themes/themes";
import type {
  BrandLogoPosition,
  DeckAsset,
  ImageLayout,
  Slide,
  SlideComposition,
  SlideCompositionMap,
  SlideMetadataMap,
  SlideTextFlowMode,
  TextBlockStyle,
  SlideTextLayout,
  TextBlockLayout
} from "./core/markdown/types";

const compositionLabels: Record<SlideComposition, string> = {
  "cover-stage": "封面",
  "section-band": "分节",
  "code-lab": "代码",
  "left-heavy": "左文",
  "right-heavy": "右文",
  "center-stage": "居中",
  "split-panel": "分栏",
  "poster-bottom": "底部",
  "image-right": "图右",
  "image-left": "图左",
  "image-full-bleed": "满版"
};

const textStyleColors = ["#18201f", "#a34722", "#111111", "#ffffff", "#e23d28", "#ff7a1a", "#f6d65b", "#67d3b0", "#2f6fed", "#8b5cf6", "#68706f"];
const customFontFaceCss = createFontFaceCss();
const previewSlideBaseWidth = 1600;
const previewSlideBaseHeight = 900;
const presentationChannelName = "ai-ppt:presentation";
const presentationStorageKey = "ai-ppt:presentation-state";
type AlignmentDirection = "left" | "center-horizontal" | "right" | "top" | "center-vertical" | "bottom";
type DraftState = ReturnType<typeof loadDraft>;
type EditorSnapshot = {
  activeSlide: number;
  draft: DraftState;
  selectedImageAssetIds: string[];
  selectedTextBlock?: string;
  selectedTextBlockIds: string[];
  selectedTextLayout?: TextBlockLayout;
};
type DraftUpdater = DraftState | ((current: DraftState) => DraftState);
type PresentationMode = "off" | "audience" | "speaker";
type PresentationMessage =
  | { type: "presentation-state"; draft: DraftState; activeSlide: number; revealStep: number }
  | { type: "presentation-end" };

const selectionAlignmentControls: Array<{ direction: AlignmentDirection; label: string; icon: typeof AlignStartHorizontal; testId: string }> = [
  { direction: "left", label: "左对齐", icon: AlignStartVertical, testId: "align-left" },
  { direction: "center-horizontal", label: "水平居中", icon: AlignCenterVertical, testId: "align-center-horizontal" },
  { direction: "right", label: "右对齐", icon: AlignEndVertical, testId: "align-right" },
  { direction: "top", label: "顶部对齐", icon: AlignStartHorizontal, testId: "align-top" },
  { direction: "center-vertical", label: "垂直居中", icon: AlignCenterHorizontal, testId: "align-center-vertical" },
  { direction: "bottom", label: "底部对齐", icon: AlignEndHorizontal, testId: "align-bottom" }
];

const defaultTextStyleByBlock: Record<"title" | "body", Required<Pick<TextBlockStyle, "fontSize" | "bold" | "lineHeight" | "letterSpacing">>> = {
  title: { fontSize: 64, bold: false, lineHeight: 1, letterSpacing: 0 },
  body: { fontSize: 28, bold: false, lineHeight: 1.3, letterSpacing: 0 }
};

function defaultTextStyleForBlock(block: string) {
  return block === "title" ? defaultTextStyleByBlock.title : defaultTextStyleByBlock.body;
}

const textFlowLabels: Record<SlideTextFlowMode, string> = {
  auto: "自动",
  one: "1列",
  two: "2列",
  three: "3列",
  grid: "网格"
};

const compositionIcons: Record<SlideComposition, typeof LayoutTemplate> = {
  "cover-stage": LayoutTemplate,
  "section-band": LayoutTemplate,
  "code-lab": Columns2,
  "left-heavy": PanelLeft,
  "right-heavy": PanelRight,
  "center-stage": AlignCenter,
  "split-panel": Columns2,
  "poster-bottom": LayoutTemplate,
  "image-right": ImagePlus,
  "image-left": ImagePlus,
  "image-full-bleed": Maximize2
};

export function App() {
  const isAudienceWindow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("presenter") === "audience";
  const [draft, setDraft] = useState(() => (isAudienceWindow ? defaultDraft : loadDraft()));
  const [activeSlide, setActiveSlide] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(isAudienceWindow ? "audience" : "off");
  const [audienceWindow, setAudienceWindow] = useState<Window | null>(null);
  const [audienceWindowClosed, setAudienceWindowClosed] = useState(false);
  const [presentationStartedAt, setPresentationStartedAt] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState("Draft auto-saved locally");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [isGeneratePanelOpen, setIsGeneratePanelOpen] = useState(false);
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [isDocumentLibraryOpen, setIsDocumentLibraryOpen] = useState(false);
  const [isTopbarCollapsed, setIsTopbarCollapsed] = useState(false);
  const [isNotesPanelCollapsed, setIsNotesPanelCollapsed] = useState(true);
  const [previewScale, setPreviewScale] = useState(1);
  const [selectedTextBlock, setSelectedTextBlock] = useState<string | undefined>(undefined);
  const [selectedTextBlockIds, setSelectedTextBlockIds] = useState<string[]>([]);
  const [selectedTextLayout, setSelectedTextLayout] = useState<TextBlockLayout | undefined>(undefined);
  const [selectedImageAssetIds, setSelectedImageAssetIds] = useState<string[]>([]);
  const [imageInsertStatus, setImageInsertStatus] = useState("Choose a PNG, JPG, WebP, or GIF under 3MB.");
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [documentLibrary, setDocumentLibrary] = useState(() =>
    isAudienceWindow ? { activeDocumentId: "", documents: [] } : loadDocumentLibrary()
  );
  const draftRef = useRef(draft);
  const presentationChannelRef = useRef<BroadcastChannel | null>(null);
  const imagePanelRef = useRef<HTMLElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const projectImportInputRef = useRef<HTMLInputElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);

  const theme = themes[draft.themeId] ?? themeList[0];
  const deck = useMemo(
    () => parseMarkdownDeck(draft.markdown, draft.assets, draft.imageLayouts),
    [draft.assets, draft.imageLayouts, draft.markdown]
  );
  const currentSlide = deck.slides[Math.min(activeSlide, deck.slides.length - 1)] ?? deck.slides[0];
  const canResetImageLayout = currentSlide.imageAssetIds.some((assetId) => draft.imageLayouts[assetId]);
  const canResetTextLayout = Boolean(
    draft.textLayouts[currentSlide.id]?.title ||
      draft.textLayouts[currentSlide.id]?.body ||
      Object.keys(draft.textLayouts[currentSlide.id]?.blocks ?? {}).length > 0
  );
  const currentComposition = getSlideComposition(currentSlide, draft.slideCompositions[currentSlide.id]);
  const currentCompositionOverride = draft.slideCompositions[currentSlide.id];
  const currentCompositionOptions = getAvailableSlideCompositions(currentSlide);
  const currentTextFlow = draft.slideTextFlows[currentSlide.id] ?? "auto";
  const currentSelectedTextLayout = selectedTextBlock
    ? getTextLayoutForBlock(draft.textLayouts[currentSlide.id], selectedTextBlock) ?? selectedTextLayout
    : undefined;
  const brandLogoAsset = draft.brandLogo ? draft.assets.find((asset) => asset.id === draft.brandLogo?.assetId && asset.dataUrl) : undefined;
  const statusClassName = getStatusClassName(status);
  const canAlignSelectedImages = selectedImageAssetIds.length >= 2;
  const canAlignSelectedTextBlocks = selectedTextBlockIds.length >= 2;
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const activeDocument = documentLibrary.documents.find((document) => document.id === documentLibrary.activeDocumentId) ?? documentLibrary.documents[0];
  const currentSpeakerNote = draft.speakerNotes?.[currentSlide.id] ?? "";
  const currentSlideIntent = draft.slideIntents?.[currentSlide.id] ?? "";
  const currentRevealPlan = draft.slideRevealPlans?.[currentSlide.id] ?? "";
  const isPresenting = presentationMode !== "off";
  const isSpeakerMode = presentationMode === "speaker";
  const isSingleWindowPresentation = presentationMode === "audience" && !isAudienceWindow;
  const nextSlide = deck.slides[Math.min(activeSlide + 1, deck.slides.length - 1)];

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(presentationChannelName);
    presentationChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<PresentationMessage>) => {
      if (!isAudienceWindow) return;
      handlePresentationMessage(event.data);
    };
    return () => {
      channel.close();
      if (presentationChannelRef.current === channel) {
        presentationChannelRef.current = null;
      }
    };
  }, [isAudienceWindow]);

  useEffect(() => {
    if (!isAudienceWindow) return;
    const raw = localStorage.getItem(presentationStorageKey);
    if (raw) {
      try {
        handlePresentationMessage(JSON.parse(raw) as PresentationMessage);
      } catch {
        // Ignore stale or malformed presentation state.
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== presentationStorageKey || !event.newValue) return;
      try {
        handlePresentationMessage(JSON.parse(event.newValue) as PresentationMessage);
      } catch {
        // Ignore malformed fallback messages.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAudienceWindow]);

  useEffect(() => {
    if (presentationMode !== "speaker") return;
    broadcastPresentationState(draft, activeSlide, revealStep);
  }, [activeSlide, draft, presentationMode, revealStep]);

  useEffect(() => {
    if (presentationMode !== "speaker") return;
    const timer = window.setInterval(() => {
      if (audienceWindow?.closed) {
        setAudienceWindowClosed((current) => (current ? current : true));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [audienceWindow, presentationMode]);

  function handlePresentationMessage(message: PresentationMessage) {
    if (message.type === "presentation-state") {
      setDraft(message.draft);
      setActiveSlide(message.activeSlide);
      setRevealStep(message.revealStep);
      setPresentationMode("audience");
      return;
    }
    if (message.type === "presentation-end") {
      setPresentationMode("off");
      setStatus("演示已结束。");
    }
  }

  function currentEditorSnapshot(): EditorSnapshot {
    return {
      activeSlide,
      draft: draftRef.current,
      selectedImageAssetIds,
      selectedTextBlock,
      selectedTextBlockIds,
      selectedTextLayout
    };
  }

  function restoreEditorSnapshot(snapshot: EditorSnapshot) {
    setDraft(snapshot.draft);
    setActiveSlide(snapshot.activeSlide);
    setSelectedImageAssetIds(snapshot.selectedImageAssetIds);
    setSelectedTextBlock(snapshot.selectedTextBlock);
    setSelectedTextBlockIds(snapshot.selectedTextBlockIds);
    setSelectedTextLayout(snapshot.selectedTextLayout);
  }

  function resetTransientEditorState() {
    setActiveSlide(0);
    setRevealStep(0);
    setPresentationMode(isAudienceWindow ? "audience" : "off");
    setSelectedImageAssetIds([]);
    setSelectedTextBlock(undefined);
    setSelectedTextBlockIds([]);
    setSelectedTextLayout(undefined);
    setUndoStack([]);
    setRedoStack([]);
  }

  async function refreshDocumentLibraryFromStorage() {
    setDocumentLibrary(loadDocumentLibrary());
  }

  function commitDraft(updater: DraftUpdater) {
    const before = currentEditorSnapshot();
    setDraft((current) => (typeof updater === "function" ? (updater as (value: DraftState) => DraftState)(current) : updater));
    setUndoStack((items) => [...items.slice(-49), before]);
    setRedoStack([]);
  }

  function undoEdit() {
    setUndoStack((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setRedoStack((redoItems) => [...redoItems.slice(-49), currentEditorSnapshot()]);
      restoreEditorSnapshot(previous);
      setStatus("已撤销上一步");
      return items.slice(0, -1);
    });
  }

  function redoEdit() {
    setRedoStack((items) => {
      const next = items.at(-1);
      if (!next) return items;
      setUndoStack((undoItems) => [...undoItems.slice(-49), currentEditorSnapshot()]);
      restoreEditorSnapshot(next);
      setStatus("已重做上一步");
      return items.slice(0, -1);
    });
  }

  async function openDocument(documentId: string) {
    saveDraft(draftRef.current);
    if (!setActiveDocument(documentId)) return;
    const nextDraft = await loadDraftWithAssets();
    setDraft(nextDraft);
    resetTransientEditorState();
    setDocumentLibrary(loadDocumentLibrary());
    setIsDocumentLibraryOpen(false);
    setStatus("已打开本地 PPT 文档");
  }

  async function createLocalDocument() {
    saveDraft(draftRef.current);
    createDocument("未命名课件");
    const nextDraft = await loadDraftWithAssets();
    setDraft(nextDraft);
    resetTransientEditorState();
    setDocumentLibrary(loadDocumentLibrary());
    setIsDocumentLibraryOpen(false);
    setStatus("已新建本地 PPT 文档");
  }

  async function duplicateLocalDocument(documentId: string) {
    saveDraft(draftRef.current);
    const document = duplicateDocument(documentId);
    if (!document) return;
    const nextDraft = await loadDraftWithAssets();
    setDraft(nextDraft);
    resetTransientEditorState();
    setDocumentLibrary(loadDocumentLibrary());
    setIsDocumentLibraryOpen(false);
    setStatus("已复制 PPT 文档");
  }

  async function deleteLocalDocument(documentId: string) {
    if (!deleteDocument(documentId)) return;
    const nextDraft = await loadDraftWithAssets();
    setDraft(nextDraft);
    resetTransientEditorState();
    setDocumentLibrary(loadDocumentLibrary());
    setStatus("已删除 PPT 文档");
  }

  function renameLocalDocument(documentId: string) {
    const currentTitle = documentLibrary.documents.find((document) => document.id === documentId)?.title ?? "未命名课件";
    const title = window.prompt("重命名 PPT", currentTitle);
    if (title === null) return;
    if (!renameDocument(documentId, title)) return;
    setDocumentLibrary(loadDocumentLibrary());
    setStatus("已重命名 PPT 文档");
  }

  function exportProjectDocument(documentId: string) {
    saveDraft(draftRef.current);
    const library = loadDocumentLibrary();
    const document = library.documents.find((item) => item.id === documentId);
    if (!document) return;
    const blob = new Blob([buildProjectExport(document.draft, document.title)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = documentCreateAnchor();
    link.href = url;
    link.download = `${slugify(document.title)}.ai-ppt.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("已导出项目备份");
  }

  function handleProjectImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        saveDraft(draftRef.current);
        const document = importProjectExport(String(reader.result ?? ""));
        await saveAssets(document.draft.assets.filter((asset) => asset.dataUrl));
        const nextDraft = await loadDraftWithAssets();
        setDraft(nextDraft);
        resetTransientEditorState();
        setDocumentLibrary(loadDocumentLibrary());
        setIsDocumentLibraryOpen(false);
        setStatus("已导入项目文件");
      } catch {
        setStatus("项目文件无法导入。");
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    setSelectedTextBlock(undefined);
    setSelectedTextBlockIds([]);
    setSelectedTextLayout(undefined);
    setSelectedImageAssetIds([]);
  }, [activeSlide]);

  useEffect(() => {
    if (isAudienceWindow) {
      setIsStorageReady(true);
      return;
    }
    let isMounted = true;
    loadDraftWithAssets()
      .then((loadedDraft) => {
        if (!isMounted) return;
        setDraft((current) => mergeHydratedAssets(current, loadedDraft));
        setIsStorageReady(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus("Image storage could not start. Existing images are preserved, but new images cannot be added.");
      });
    return () => {
      isMounted = false;
    };
  }, [isAudienceWindow]);

  useEffect(() => {
    if (isAudienceWindow || isPresenting) return;
    if (!isStorageReady) return;
    if (!saveDraft(draft)) {
      setStatus("Draft metadata could not be saved. Image files are stored separately.");
    }
    setDocumentLibrary(loadDocumentLibrary());
  }, [draft, isAudienceWindow, isPresenting, isStorageReady]);

  useEffect(() => {
    if (activeSlide > deck.slides.length - 1) {
      setActiveSlide(Math.max(deck.slides.length - 1, 0));
    }
  }, [activeSlide, deck.slides.length]);

  useEffect(() => {
    if (isImagePanelOpen) {
      window.requestAnimationFrame(() => imagePanelRef.current?.focus());
    }
  }, [isImagePanelOpen]);

  useEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return;

    function updatePreviewScale() {
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const nextScale = Math.min(rect.width / previewSlideBaseWidth, rect.height / previewSlideBaseHeight, 1);
      setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    }

    updatePreviewScale();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePreviewScale);
    observer?.observe(stage);
    window.addEventListener("resize", updatePreviewScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePreviewScale);
    };
  }, [isTopbarCollapsed, deck.slides.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isUndoKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
      if (isUndoKey && !isPresenting) {
        event.preventDefault();
        if (event.shiftKey) {
          redoEdit();
        } else {
          undoEdit();
        }
        return;
      }
      if (!isPresenting || isAudienceWindow) return;
      if (["Enter", "ArrowRight", " ", "PageDown"].includes(event.key)) {
        event.preventDefault();
        advanceRevealOrSlide();
      }
      if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        retreatRevealOrSlide();
      }
      if (event.key === "Escape") {
        stopPresentation();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlide, deck.slides, isAudienceWindow, isPresenting, revealStep, undoStack, redoStack, draft, selectedImageAssetIds, selectedTextBlock, selectedTextBlockIds, selectedTextLayout]);

  function updateMarkdown(markdown: string) {
    commitDraft((current) => {
      const preservedAssetIds = getPreservedAssetIds(current);
      void deleteAssets(getUnusedAssetIds(markdown, current.assets, preservedAssetIds));
      const assets = pruneUnusedAssets(markdown, current.assets, preservedAssetIds);
      const imageLayouts = pruneUnusedImageLayouts(current.imageLayouts, markdown);
      const nextDeck = parseMarkdownDeck(markdown, assets, imageLayouts);
      return {
        ...current,
        markdown,
        assets,
        imageLayouts,
        slideCompositions: pruneSlideCompositions(current.slideCompositions, nextDeck.slides),
        slideTextFlows: pruneSlideTextFlows(current.slideTextFlows, nextDeck.slides),
        textLayouts: pruneTextLayouts(current.textLayouts, nextDeck.slides)
      };
    });
    setStatus("Draft auto-saved locally");
  }

  function duplicateCurrentSlide() {
    const targetSlideIndex = Math.min(activeSlide, deck.slides.length - 1);
    commitDraft((current) => {
      const currentDeck = parseMarkdownDeck(current.markdown, current.assets, current.imageLayouts);
      const currentSlideIndex = Math.min(targetSlideIndex, currentDeck.slides.length - 1);
      const markdown = duplicateMarkdownSlide(current.markdown, currentSlideIndex);
      const nextDeck = parseMarkdownDeck(markdown, current.assets, current.imageLayouts);
      return {
        ...current,
        markdown,
        slideCompositions: remapDuplicatedSlideValues(current.slideCompositions, currentDeck.slides, nextDeck.slides, currentSlideIndex),
        slideTextFlows: remapDuplicatedSlideValues(current.slideTextFlows, currentDeck.slides, nextDeck.slides, currentSlideIndex),
        textLayouts: remapDuplicatedSlideValues(current.textLayouts, currentDeck.slides, nextDeck.slides, currentSlideIndex)
      };
    });
    setActiveSlide(targetSlideIndex + 1);
    setStatus("已复制本页，并插入到当前页后。");
  }

  function updateTheme(themeId: string) {
    commitDraft((current) => ({ ...current, themeId }));
    setStatus(`Theme set to ${themes[themeId].name}`);
  }

  async function handleOptimize() {
    setIsOptimizing(true);
    setIsAiMenuOpen(false);
    setStatus("正在优化文案...");
    try {
      const result = await optimizeMarkdown({
        markdown: draft.markdown,
        intent: "lesson",
        themeId: draft.themeId
      });
      commitDraft((current) => ({
        ...current,
        markdown: result.markdown,
        assets: pruneUnusedAssets(result.markdown, current.assets, getPreservedAssetIds(current)),
        imageLayouts: pruneUnusedImageLayouts(current.imageLayouts, result.markdown),
        slideCompositions: pruneSlideCompositions(
          current.slideCompositions,
          parseMarkdownDeck(result.markdown, current.assets, current.imageLayouts).slides
        ),
        slideTextFlows: pruneSlideTextFlows(current.slideTextFlows, parseMarkdownDeck(result.markdown, current.assets, current.imageLayouts).slides),
        textLayouts: pruneTextLayouts(
          current.textLayouts,
          parseMarkdownDeck(result.markdown, current.assets, current.imageLayouts).slides
        )
      }));
      setStatus(result.notes?.[0] ?? "已优化文案：拆分长页，压缩要点，保留原有图片。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleGenerateDeck(input: GenerateOutlineInput, outline: GeneratedOutline) {
    setIsGeneratingDeck(true);
    setStatus("正在把大纲变成可编辑 PPT...");
    try {
      const result = await generateDeck(input, outline);
      const generatedDeck = parseMarkdownDeck(result.markdown, []);
      const themeId = themes[result.themeId] ? result.themeId : "teaching-whiteboard";
      const nextDraft: DraftState = {
        markdown: result.markdown,
        themeId,
        assets: [],
        imageLayouts: {},
        slideCompositions: sanitizeGeneratedCompositions(result.slideCompositions, generatedDeck.slides),
        slideTextFlows: sanitizeGeneratedTextFlows(result.slideTextFlows ?? {}, generatedDeck.slides),
        textLayouts: {},
        speakerNotes: sanitizeGeneratedMetadata(result.speakerNotes ?? {}, generatedDeck.slides),
        slideIntents: sanitizeGeneratedMetadata(result.slideIntents ?? {}, generatedDeck.slides),
        slideRevealPlans: sanitizeGeneratedMetadata(result.revealPlan ?? {}, generatedDeck.slides),
        brandLogo: undefined
      };
      saveDraft(draftRef.current);
      createDocumentWithDraft(generatedDeck.title || outline.title || input.topic, nextDraft);
      const hydratedDraft = await loadDraftWithAssets();
      setDraft(hydratedDraft);
      resetTransientEditorState();
      setDocumentLibrary(loadDocumentLibrary());
      setIsGeneratePanelOpen(false);
      setStatus(`已生成 ${generatedDeck.slides.length} 页课件，可继续拖动文字、插图和调整版式。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI PPT 生成失败。");
      throw error;
    } finally {
      setIsGeneratingDeck(false);
    }
  }

  function updateCurrentSpeakerNote(note: string) {
    commitDraft((current) => ({
      ...current,
      speakerNotes: {
        ...(current.speakerNotes ?? {}),
        [currentSlide.id]: note
      }
    }));
    setStatus("讲稿已保存");
  }

  function handleOptimizeLayout() {
    setIsAiMenuOpen(false);
    const suggestion = suggestAlternativeSlideCompositions(deck.slides, draft.slideCompositions);
    commitDraft((current) => ({
      ...current,
      slideCompositions: suggestion.slideCompositions
    }));
    if (suggestion.changedSlideIds.length === 0) {
      setStatus("当前页面已经是推荐排版。");
      return;
    }

    if (!suggestion.changedSlideIds.includes(currentSlide.id)) {
      const firstChangedIndex = deck.slides.findIndex((slide) => slide.id === suggestion.changedSlideIds[0]);
      if (firstChangedIndex >= 0) setActiveSlide(firstChangedIndex);
    }
    setStatus(`已优化排版：调整了 ${suggestion.changedSlideIds.length} / ${deck.slides.length} 页。`);
  }

  function handleBeautifyDeck() {
    setIsAiMenuOpen(false);
    if (isPresenting) {
      setStatus("演讲模式中不能美化，退出后再调整。");
      return;
    }
    const result = beautifyDeckLayout(deck.slides, draft.slideCompositions, draft.slideTextFlows, draft.textLayouts);
    commitDraft((current) => ({
      ...current,
      slideCompositions: result.slideCompositions,
      slideTextFlows: result.slideTextFlows
    }));
    if (result.changedSlideIds.length > 0 && !result.changedSlideIds.includes(currentSlide.id)) {
      const firstChangedIndex = deck.slides.findIndex((slide) => slide.id === result.changedSlideIds[0]);
      if (firstChangedIndex >= 0) setActiveSlide(firstChangedIndex);
    }
    setStatus(`AI 美化完成：${result.summary.join("，")}。`);
  }

  function handleCheckCurrentSlide() {
    if (isPresenting) {
      setStatus("演讲模式中不能检查，退出后再调整。");
      return;
    }
    const measure = collectCurrentSlideMeasure();
    if (!measure) {
      setStatus("暂时无法检查本页，请稍后再试。");
      return;
    }
    const health = analyzeSlideHealth(measure);
    setStatus(health.summary);
  }

  function handleBeautifyCurrentSlide() {
    if (isPresenting) {
      setStatus("演讲模式中不能美化，退出后再调整。");
      return;
    }
    const measure = collectCurrentSlideMeasure();
    if (!measure) {
      setStatus("暂时无法美化本页，请稍后再试。");
      return;
    }
    const health = analyzeSlideHealth(measure);
    const patch = createSlideAutoLayoutPatch({
      slide: currentSlide,
      health,
      currentComposition,
      currentTextFlow,
      currentTextLayout: draft.textLayouts[currentSlide.id]
    });
    if (!patch.changed) {
      setStatus(patch.summary);
      return;
    }
    commitDraft((current) => {
      const slideCompositions = { ...current.slideCompositions };
      if (patch.slideCompositions?.[currentSlide.id]) {
        slideCompositions[currentSlide.id] = patch.slideCompositions[currentSlide.id];
      }

      const slideTextFlows = { ...current.slideTextFlows };
      const nextTextFlow = patch.slideTextFlows?.[currentSlide.id];
      if (nextTextFlow === "auto") {
        delete slideTextFlows[currentSlide.id];
      } else if (nextTextFlow) {
        slideTextFlows[currentSlide.id] = nextTextFlow;
      }

      const textLayouts = patch.textLayout
        ? {
            ...current.textLayouts,
            [currentSlide.id]: patch.textLayout
          }
        : current.textLayouts;

      return {
        ...current,
        slideCompositions,
        slideTextFlows,
        textLayouts
      };
    });
    clearTextSelection();
    setSelectedImageAssetIds([]);
    setStatus(patch.summary);
  }

  function handleExport() {
    const html = createStandaloneHtml(
      deck,
      theme,
      draft.slideCompositions,
      brandLogoAsset,
      draft.brandLogo?.position,
      draft.slideTextFlows,
      draft.textLayouts,
      draft.speakerNotes,
      draft.slideIntents,
      draft.slideRevealPlans
    );
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(deck.title)}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Exported standalone HTML");
  }

  function updateImageLayout(assetId: string, layout: ImageLayout) {
    commitDraft((current) => ({
      ...current,
      imageLayouts: {
        ...current.imageLayouts,
        [assetId]: normalizeImageLayout(layout)
      }
    }));
    setStatus("Image layout saved");
  }

  function updateImageLayouts(layouts: Record<string, ImageLayout>) {
    commitDraft((current) => ({
      ...current,
      imageLayouts: {
        ...current.imageLayouts,
        ...Object.fromEntries(Object.entries(layouts).map(([assetId, layout]) => [assetId, normalizeImageLayout(layout)]))
      }
    }));
    setStatus("Image layout saved");
  }

  function resetCurrentImageLayout() {
    if (currentSlide.imageAssetIds.length === 0) return;
    commitDraft((current) => {
      const imageLayouts = { ...current.imageLayouts };
      currentSlide.imageAssetIds.forEach((assetId) => {
        delete imageLayouts[assetId];
      });
      return { ...current, imageLayouts };
    });
    setStatus("Image layout reset");
  }

  function updateSlideTextFlow(mode: SlideTextFlowMode) {
    commitDraft((current) => {
      const slideTextFlows = { ...current.slideTextFlows };
      const textLayouts = { ...current.textLayouts };
      if (mode === "auto") {
        delete slideTextFlows[currentSlide.id];
      } else {
        slideTextFlows[currentSlide.id] = mode;
        const currentTextLayout = textLayouts[currentSlide.id];
        if (currentTextLayout?.body) {
          const { body: _body, ...nextTextLayout } = currentTextLayout;
          textLayouts[currentSlide.id] = nextTextLayout;
        }
      }
      return { ...current, slideTextFlows, textLayouts };
    });
    setSelectedTextBlock(undefined);
    setSelectedTextBlockIds([]);
    setSelectedTextLayout(undefined);
    setStatus(mode === "auto" ? "Text flow set to auto" : `Text flow set to ${textFlowLabels[mode]}，已解除旧正文整体布局`);
  }

  function updateTextLayout(block: string, layout: TextBlockLayout) {
    const freeLayout = normalizeTextBlockLayout({ ...layout, mode: "free" });
    commitDraft((current) => ({
      ...current,
      textLayouts: {
        ...current.textLayouts,
        [currentSlide.id]: setTextLayoutForBlock(current.textLayouts[currentSlide.id], block, freeLayout)
      }
    }));
    setStatus("Text layout saved");
  }

  function updateTextLayouts(layouts: Record<string, TextBlockLayout>) {
    commitDraft((current) => {
      const currentSlideLayout = current.textLayouts[currentSlide.id];
      return {
        ...current,
        textLayouts: {
          ...current.textLayouts,
          [currentSlide.id]: Object.entries(layouts).reduce(
            (slideLayout, [block, layout]) => setTextLayoutForBlock(slideLayout, block, normalizeTextBlockLayout({ ...layout, mode: "free" })),
            currentSlideLayout ?? {}
          )
        }
      };
    });
    setStatus("Text layout saved");
  }

  function selectTextBlock(block: string, layout: TextBlockLayout) {
    setSelectedTextBlock(block);
    setSelectedTextBlockIds([block]);
    setSelectedTextLayout(layout);
  }

  function updateTextSelection(blockIds: string[], primaryBlockId?: string, primaryLayout?: TextBlockLayout) {
    setSelectedTextBlockIds(blockIds);
    setSelectedTextBlock(primaryBlockId);
    setSelectedTextLayout(primaryLayout);
  }

  function alignSelectedObjects(direction: AlignmentDirection) {
    const canvas = previewStageRef.current?.querySelector<HTMLElement>(".slide-canvas");
    if (!canvas) return;
    const slideRect = canvas.getBoundingClientRect();

    if (selectedImageAssetIds.length >= 2) {
      const layouts = Object.fromEntries(
        selectedImageAssetIds
          .map((assetId) => {
            const frame = canvas.querySelector<HTMLElement>(`.slide-image-frame[data-asset-id="${cssEscape(assetId)}"]`);
            if (!frame) return undefined;
            return [assetId, readFrameLayout(frame, slideRect, draft.imageLayouts[assetId])] as const;
          })
          .filter((item): item is readonly [string, ImageLayout] => Boolean(item))
      );
      const alignedLayouts = alignImageLayouts(layouts, direction);
      if (Object.keys(alignedLayouts).length < 2) return;
      updateImageLayouts(alignedLayouts);
      setSelectedImageAssetIds(Object.keys(alignedLayouts));
      setStatus(`已对齐 ${Object.keys(alignedLayouts).length} 张图片`);
      return;
    }

    if (selectedTextBlockIds.length >= 2) {
      const slideTextLayout = draft.textLayouts[currentSlide.id];
      const layouts = Object.fromEntries(
        selectedTextBlockIds
          .map((block) => {
            const element = canvas.querySelector<HTMLElement>(`.slide-text-block[data-text-block="${cssEscape(block)}"]`);
            if (!element) return undefined;
            return [block, readTextBlockLayout(element, slideRect, getTextLayoutForBlock(slideTextLayout, block))] as const;
          })
          .filter((item): item is readonly [string, TextBlockLayout] => Boolean(item))
      );
      const alignedLayouts = alignTextBlockLayouts(layouts, direction);
      if (Object.keys(alignedLayouts).length < 2) return;
      updateTextLayouts(alignedLayouts);
      updateTextSelection(Object.keys(alignedLayouts), selectedTextBlock, alignedLayouts[selectedTextBlock ?? ""]);
      setStatus(`已对齐 ${Object.keys(alignedLayouts).length} 个文本框`);
    }
  }

  function collectCurrentSlideMeasure(): SlideMeasure | undefined {
    const canvas = previewStageRef.current?.querySelector<HTMLElement>(".slide-canvas");
    if (!canvas) return undefined;
    const canvasRect = canvas.getBoundingClientRect();
    const elements: SlideMeasuredElement[] = [];

    const titleBlock = canvas.querySelector<HTMLElement>(".slide-text-block[data-text-block='title']");
    const titleContent = titleBlock?.querySelector<HTMLElement>("h1, h2, h3") ?? titleBlock;
    if (titleBlock && titleContent) {
      const layout = titleBlock.dataset.textLayout === "free" ? "free" : "flow";
      elements.push({
        id: "title",
        kind: "title",
        rect: toSlideRect(titleContent.getBoundingClientRect()),
        isFree: layout === "free",
        layout
      });
    }

    canvas.querySelectorAll<HTMLElement>(".slide-text-block[data-text-block]").forEach((block) => {
      const blockId = block.dataset.textBlock;
      if (!blockId || blockId === "title") return;
      const layout = block.dataset.textLayout === "free" ? "free" : "flow";
      const content = getMeasuredTextContent(block);
      const rect = content.getBoundingClientRect();
      elements.push({
        id: blockId,
        kind: "text",
        rect: toSlideRect(rect),
        isFree: layout === "free",
        layout
      });
    });

    canvas.querySelectorAll<HTMLElement>(".slide-image-frame[data-asset-id]").forEach((frame) => {
      const layout = frame.dataset.imageLayout === "free" ? "free" : "flow";
      elements.push({
        id: frame.dataset.assetId ?? "image",
        kind: "image",
        rect: toSlideRect(frame.getBoundingClientRect()),
        isFree: layout === "free",
        layout
      });
    });

    return {
      canvas: toSlideRect(canvasRect),
      elements,
      composition: currentComposition,
      textFlow: currentTextFlow
    };
  }

  function getMeasuredTextContent(block: HTMLElement) {
    const content = block.querySelector<HTMLElement>(".slide-text-block-html, li, p, h1, h2, h3");
    if (!content) return block;
    const contentRect = content.getBoundingClientRect();
    return contentRect.width > 0 && contentRect.height > 0 ? content : block;
  }

  function clearTextSelection() {
    setSelectedTextBlock(undefined);
    setSelectedTextBlockIds([]);
    setSelectedTextLayout(undefined);
  }

  function deselectTextBlock() {
    clearTextSelection();
  }

  function updateSelectedTextStyle(patch: TextBlockStyle) {
    if (!selectedTextBlock) return;
    commitDraft((current) => {
      const currentSlideLayout = current.textLayouts[currentSlide.id] ?? {};
      const savedLayout = getTextLayoutForBlock(currentSlideLayout, selectedTextBlock);
      const existingLayout = savedLayout ?? (selectedTextLayout ? normalizeTextBlockLayout(selectedTextLayout) : undefined);
      if (!existingLayout) return current;
      const nextStyle = cleanTextStyle({
        ...existingLayout.style,
        ...patch
      });
      const shouldKeepFreeLayout = isFreeTextLayout(savedLayout);
      const nextLayout = shouldKeepFreeLayout ? { ...existingLayout, mode: "free" as const } : { x: 50, y: 50 };
      return {
        ...current,
        textLayouts: {
          ...current.textLayouts,
          [currentSlide.id]: setTextLayoutForBlock(
            currentSlideLayout,
            selectedTextBlock,
            normalizeTextBlockLayout({
              ...nextLayout,
              ...(nextStyle ? { style: nextStyle } : { style: undefined })
            })
          )
        }
      };
    });
    setStatus("Text style saved");
  }

  function resetCurrentTextLayout() {
    commitDraft((current) => {
      const textLayouts = { ...current.textLayouts };
      delete textLayouts[currentSlide.id];
      return { ...current, textLayouts };
    });
    setSelectedTextBlock(undefined);
    setSelectedTextBlockIds([]);
    setSelectedTextLayout(undefined);
    setStatus("Text layout reset");
  }

  function updateSlideComposition(composition: SlideComposition | "auto") {
    commitDraft((current) => {
      const slideCompositions = { ...current.slideCompositions };
      if (composition === "auto") {
        delete slideCompositions[currentSlide.id];
      } else {
        slideCompositions[currentSlide.id] = composition;
      }
      return { ...current, slideCompositions };
    });
    setStatus(composition === "auto" ? "Slide layout set to auto" : `Slide layout set to ${compositionLabels[composition]}`);
  }

  function updateBrandLogoPosition(position: BrandLogoPosition) {
    commitDraft((current) => ({
      ...current,
      brandLogo: current.brandLogo ? { ...current.brandLogo, position } : undefined
    }));
    setStatus(position === "top-left" ? "Logo moved to top left" : "Logo moved to top right");
  }

  function removeBrandLogo() {
    commitDraft((current) => {
      if (current.brandLogo) {
        void deleteAssets([current.brandLogo.assetId]);
      }
      return {
        ...current,
        assets: current.assets.filter((asset) => asset.id !== current.brandLogo?.assetId),
        brandLogo: undefined
      };
    });
    setStatus("Logo removed");
  }

  function handleBrandLogoInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void insertBrandLogoFile(file);
  }

  async function insertBrandLogoFile(file: File | undefined) {
    if (!file) {
      setStatus("No logo selected.");
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setStatus("Please choose a PNG, JPG, WebP, or GIF logo.");
      return;
    }

    if (isImageTooLarge(file.size)) {
      setStatus(`Logo is too large. Please choose one under ${maxImageSizeMb}MB.`);
      return;
    }

    const reader = new FileReader();
    setStatus("Reading logo...");
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? "");
      if (!dataUrl.startsWith("data:image/")) {
        setStatus("Could not read this logo.");
        return;
      }

      const asset = buildImageAsset({
        fileName: file.name,
        dataUrl,
        sizeBytes: file.size
      });

      try {
        await saveAsset(asset);
      } catch {
        setStatus("Could not save this logo locally. Please try a smaller image.");
        return;
      }

      const currentDraft = draftRef.current;
      const oldLogoId = currentDraft.brandLogo?.assetId;
      if (oldLogoId && oldLogoId !== asset.id) {
        void deleteAssets([oldLogoId]);
      }
      const nextDraft = {
        ...currentDraft,
        assets: [...currentDraft.assets.filter((item) => item.id !== asset.id && item.id !== oldLogoId), asset],
        brandLogo: {
          assetId: asset.id,
          position: currentDraft.brandLogo?.position ?? "top-right"
        } satisfies { assetId: string; position: BrandLogoPosition }
      };
      if (!saveDraft(nextDraft)) {
        setStatus("Draft metadata could not be saved. Logo file is stored separately.");
        return;
      }

      commitDraft(nextDraft);
      setStatus(`Logo set: ${file.name}`);
    };
    reader.onerror = () => setStatus("Could not read this logo.");
    reader.readAsDataURL(file);
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateMarkdown(String(reader.result ?? ""));
      setStatus(`Imported ${file.name}`);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleImageDrop(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    const files = [...event.dataTransfer.files].filter((item) => item.type.startsWith("image/"));
    if (files.length === 0) {
      setImageInsertStatus("Drop a PNG, JPG, WebP, or GIF image here.");
      return;
    }
    void insertImageFiles(files);
  }

  function handleImagePaste(event: ReactClipboardEvent<HTMLElement>) {
    const files = [...event.clipboardData.files].filter((item) => item.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    void insertImageFiles(files);
  }

  function handleInsertImage(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    void insertImageFiles(files);
  }

  async function insertImageFiles(files: File[]) {
    if (files.length === 0) {
      setImageInsertStatus("No image selected.");
      return;
    }

    if (files.length > 9) {
      setImageInsertStatus("最多一次上传 9 张图片。");
      return;
    }

    const invalidFile = files.find((file) => !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type));
    if (invalidFile) {
      setImageInsertStatus("Please choose a PNG, JPG, WebP, or GIF image.");
      return;
    }

    const oversizedFile = files.find((file) => isImageTooLarge(file.size));
    if (oversizedFile) {
      setImageInsertStatus(`Image is too large. Please choose one under ${maxImageSizeMb}MB.`);
      return;
    }

    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Markdown source"]');
    setStatus(files.length === 1 ? "Reading image..." : `Reading ${files.length} images...`);
    setImageInsertStatus(files.length === 1 ? "Reading image..." : `Reading ${files.length} images...`);

    try {
      const assets: DeckAsset[] = [];
      const imageMarkdownParts: string[] = [];
      const imageLayouts: Record<string, ImageLayout> = {};

      for (const [index, file] of files.entries()) {
        const dataUrl = await readFileAsDataUrl(file);
        if (!dataUrl.startsWith("data:image/")) {
          setImageInsertStatus("Could not read this image.");
          return;
        }
        const asset = buildImageAsset({
          fileName: file.name,
          dataUrl,
          sizeBytes: file.size
        });
        await saveAsset(asset);
        assets.push(asset);
        imageMarkdownParts.push(
          buildInlineImageMarkdown({
            fileName: file.name,
            assetId: asset.id
          })
        );
        imageLayouts[asset.id] = defaultInsertedImageLayout(index, files.length);
      }

      const currentDraft = draftRef.current;
      const targetSlideIndex = Math.min(activeSlide, parseMarkdownDeck(currentDraft.markdown, currentDraft.assets, currentDraft.imageLayouts).slides.length - 1);
      const result = insertImageIntoSlide({
        source: currentDraft.markdown,
        slideIndex: targetSlideIndex,
        insertText: imageMarkdownParts.join("\n\n"),
      });
      const newAssetIds = new Set(assets.map((asset) => asset.id));
      const nextAssets = [...currentDraft.assets.filter((item) => !newAssetIds.has(item.id)), ...assets];
      const nextDeck = parseMarkdownDeck(result.value, nextAssets);

      const nextDraft = {
        ...currentDraft,
        markdown: result.value,
        assets: pruneUnusedAssets(result.value, nextAssets, getPreservedAssetIds(currentDraft)),
        imageLayouts: pruneUnusedImageLayouts(
          {
            ...currentDraft.imageLayouts,
            ...imageLayouts
          },
          result.value
        ),
        slideCompositions: pruneSlideCompositions(currentDraft.slideCompositions, nextDeck.slides),
        slideTextFlows: pruneSlideTextFlows(currentDraft.slideTextFlows, nextDeck.slides),
        textLayouts: pruneTextLayouts(currentDraft.textLayouts, nextDeck.slides)
      };
      if (!saveDraft(nextDraft)) {
        setStatus("Draft metadata could not be saved. Image files are stored separately.");
        setImageInsertStatus("Draft metadata could not be saved. Image files are stored separately.");
        return;
      }

      commitDraft(nextDraft);
      setActiveSlide(Math.min(targetSlideIndex, nextDeck.slides.length - 1));
      setSelectedImageAssetIds(assets.map((asset) => asset.id));
      setStatus(assets.length === 1 ? `Inserted image into current slide: ${assets[0].name}` : `已插入 ${assets.length} 张图片到当前页。`);
      setImageInsertStatus(assets.length === 1 ? `Inserted image into current slide: ${assets[0].name}` : `已插入 ${assets.length} 张图片到当前页。`);
      setIsImagePanelOpen(false);
      window.requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(result.cursor, result.cursor);
      });
    } catch {
      setStatus("Could not save this image locally. Please try a smaller image.");
      setImageInsertStatus("Could not save this image locally. Please try a smaller image.");
    }
  }

  function startPresentation() {
    setRevealStep(0);
    setPresentationMode("audience");
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    void fullscreenRequest?.catch(() => undefined);
  }

  function startSpeakerMode() {
    saveDraft(draftRef.current);
    const openedWindow = openAudienceWindow();
    if (!openedWindow) {
      setStatus("浏览器阻止了观众窗口，请允许弹窗后重试。");
      return;
    }
    setAudienceWindow(openedWindow);
    setAudienceWindowClosed(false);
    setRevealStep(0);
    setPresentationStartedAt(Date.now());
    setPresentationMode("speaker");
    window.setTimeout(() => broadcastPresentationState(draftRef.current, activeSlide, 0), 120);
  }

  function reopenAudienceWindow() {
    const openedWindow = openAudienceWindow();
    if (!openedWindow) {
      setStatus("浏览器阻止了观众窗口，请允许弹窗后重试。");
      return;
    }
    setAudienceWindow(openedWindow);
    setAudienceWindowClosed(false);
    window.setTimeout(() => broadcastPresentationState(draftRef.current, activeSlide, revealStep), 120);
  }

  function openAudienceWindow() {
    return window.open(`${window.location.origin}${window.location.pathname}?presenter=audience`, "ai-ppt-audience");
  }

  function stopPresentation() {
    if (presentationMode === "speaker") {
      broadcastPresentationEnd();
    }
    setPresentationMode(isAudienceWindow ? "audience" : "off");
    setPresentationStartedAt(undefined);
    if (document.fullscreenElement) {
      const fullscreenExit = document.exitFullscreen?.();
      void fullscreenExit?.catch(() => undefined);
    }
  }

  function broadcastPresentationState(nextDraft: DraftState, nextActiveSlide: number, nextRevealStep: number) {
    const message: PresentationMessage = {
      type: "presentation-state",
      draft: nextDraft,
      activeSlide: nextActiveSlide,
      revealStep: nextRevealStep
    };
    presentationChannelRef.current?.postMessage(message);
    localStorage.setItem(presentationStorageKey, JSON.stringify(message));
  }

  function broadcastPresentationEnd() {
    const message: PresentationMessage = { type: "presentation-end" };
    presentationChannelRef.current?.postMessage(message);
    localStorage.setItem(presentationStorageKey, JSON.stringify(message));
  }

  function advanceRevealOrSlide() {
    const revealCount = countRevealItems(currentSlide.html);
    if (revealCount > 0 && revealStep < revealCount - 1) {
      setRevealStep((step) => {
        const nextStep = step + 1;
        if (presentationMode === "speaker") {
          broadcastPresentationState(draftRef.current, activeSlide, nextStep);
        }
        return nextStep;
      });
      return;
    }
    setActiveSlide((slide) => {
      const nextSlide = Math.min(slide + 1, deck.slides.length - 1);
      if (nextSlide !== slide) {
        setRevealStep(0);
        if (presentationMode === "speaker") {
          broadcastPresentationState(draftRef.current, nextSlide, 0);
        }
      }
      return nextSlide;
    });
  }

  function retreatRevealOrSlide() {
    if (revealStep > 0) {
      setRevealStep((step) => {
        const nextStep = step - 1;
        if (presentationMode === "speaker") {
          broadcastPresentationState(draftRef.current, activeSlide, nextStep);
        }
        return nextStep;
      });
      return;
    }
    setActiveSlide((slide) => {
      const previousSlide = Math.max(slide - 1, 0);
      if (previousSlide !== slide) {
        const previousRevealCount = countRevealItems(deck.slides[previousSlide]?.html ?? "");
        const nextStep = Math.max(previousRevealCount - 1, 0);
        setRevealStep(nextStep);
        if (presentationMode === "speaker") {
          broadcastPresentationState(draftRef.current, previousSlide, nextStep);
        }
      }
      return previousSlide;
    });
  }

  if (isAudienceWindow) {
    return (
      <div style={themeStyle(theme.css)}>
        {customFontFaceCss ? <style data-custom-fonts>{customFontFaceCss}</style> : null}
        <AudiencePresentationView
          brandLogoAsset={brandLogoAsset}
          brandLogoPosition={draft.brandLogo?.position}
          currentCompositionOverride={currentCompositionOverride}
          currentSlide={currentSlide}
          deckLength={deck.slides.length}
          isEnded={presentationMode === "off"}
          revealStep={revealStep}
          slideIndex={activeSlide}
          textLayout={draft.textLayouts[currentSlide.id]}
        />
      </div>
    );
  }

  return (
    <div
      className={`app ${isPresenting ? "app--presenting" : ""} ${isTopbarCollapsed ? "app--topbar-collapsed" : ""}`}
      style={themeStyle(theme.css)}
    >
      {customFontFaceCss ? <style data-custom-fonts>{customFontFaceCss}</style> : null}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <h1>AI PPT</h1>
            <p>Markdown to editable HTML slides</p>
          </div>
        </div>

        <div className="actions">
          <button
            className="icon-button"
            data-testid="open-document-library"
            onClick={() => {
              setDocumentLibrary(loadDocumentLibrary());
              setIsDocumentLibraryOpen(true);
            }}
            title="本地 PPT 文档"
            type="button"
          >
            <FolderOpen size={17} />
            <span>{activeDocument?.title ?? "文档"}</span>
          </button>
          <button
            aria-label={isTopbarCollapsed ? "Expand topbar" : "Collapse topbar"}
            className="icon-button topbar-toggle"
            data-testid="toggle-topbar"
            onClick={() => setIsTopbarCollapsed((collapsed) => !collapsed)}
            title={isTopbarCollapsed ? "Expand topbar" : "Collapse topbar"}
            type="button"
          >
            {isTopbarCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
          <button
            className="primary-button primary-button--generate"
            data-testid="open-generate-deck"
            disabled={isGeneratingDeck}
            onClick={() => setIsGeneratePanelOpen(true)}
            title="AI 生成课件"
            type="button"
          >
            <BookOpen size={17} />
            <span>{isGeneratingDeck ? "生成中" : "AI 生成课件"}</span>
          </button>
          <label aria-label="Import Markdown" className="icon-button" role="button" title="Import Markdown">
            <FileInput size={17} />
            <input accept=".md,.markdown,.txt" name="markdown-import" onChange={handleImport} type="file" />
          </label>
          <button
            className="icon-button"
            data-testid="open-image-panel"
            onClick={() => {
              setImageInsertStatus("Choose a PNG, JPG, WebP, or GIF under 3MB.");
              setIsImagePanelOpen(true);
            }}
            title="Insert image into Markdown"
            type="button"
          >
            <ImagePlus size={17} />
          </button>
          <div className="ai-menu">
            <button
              aria-expanded={isAiMenuOpen}
              className="icon-button"
              data-testid="ai-menu-button"
              disabled={isOptimizing}
              onClick={() => setIsAiMenuOpen((open) => !open)}
              title="AI optimize"
              type="button"
            >
              <Brain size={17} />
              <span>{isOptimizing ? "优化中" : "AI 优化"}</span>
              <ChevronDown size={14} />
            </button>
            {isAiMenuOpen ? (
              <div className="ai-menu-popover" role="menu">
                <button data-testid="ai-beautify-deck" onClick={handleBeautifyDeck} role="menuitem" type="button">
                  <strong>美化整套 PPT</strong>
                  <span>调整版式、留白、分栏和页面节奏</span>
                </button>
                <button data-testid="ai-optimize-copy" onClick={handleOptimize} role="menuitem" type="button">
                  <strong>优化文案</strong>
                  <span>拆分页数，压缩要点，保留图片</span>
                </button>
                <button data-testid="ai-optimize-layout" onClick={handleOptimizeLayout} role="menuitem" type="button">
                  <strong>优化排版</strong>
                  <span>推荐每页版式，让节奏更丰富</span>
                </button>
              </div>
            ) : null}
          </div>
          <button className="icon-button" data-testid="present-deck" onClick={startPresentation} title="Present" type="button">
            <MonitorPlay size={17} />
          </button>
          <button className="icon-button" data-testid="speaker-mode" onClick={startSpeakerMode} title="讲者模式" type="button">
            <Presentation size={17} />
            <span>讲者模式</span>
          </button>
          <button className="primary-button" data-testid="export-html" onClick={handleExport} title="Export HTML" type="button">
            <Download size={17} />
            <span>Export HTML</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="editor-pane">
          <div className="pane-head">
            <div>
              <span className="eyebrow">Source</span>
              <h2>Markdown</h2>
            </div>
            <div className={statusClassName}>
              <Save size={14} />
              {status}
            </div>
          </div>
          <textarea
            aria-label="Markdown source"
            name="markdown-source"
            onChange={(event) => updateMarkdown(event.target.value)}
            spellCheck={false}
            value={draft.markdown}
          />
        </section>

        <section className="preview-pane">
          <div className="pane-head pane-head--preview">
            <div>
              <span className="eyebrow">Preview</span>
              <h2>{deck.title}</h2>
            </div>
            <div className="preview-toolbar" data-testid="preview-toolbar">
              <div className="preview-toolbar-track">
                <div className="preview-toolbar-group preview-toolbar-group--theme" aria-label="Slide themes">
                  <Palette size={16} />
                  {themeList.map((item) => (
                    <button
                      className={item.id === theme.id ? "theme-pill theme-pill--active" : "theme-pill"}
                      data-testid={`theme-${item.id}`}
                      key={item.id}
                      onClick={() => updateTheme(item.id)}
                      style={themeStyle(item.css)}
                      title={item.description}
                      type="button"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>

                <div className="preview-toolbar-group preview-toolbar-group--composition" aria-label="Current slide layout">
                  <LayoutTemplate size={16} />
                  <span>版式</span>
                  <button
                    className={!currentCompositionOverride ? "composition-pill composition-pill--active" : "composition-pill"}
                    data-testid="composition-auto"
                    onClick={() => updateSlideComposition("auto")}
                    type="button"
                  >
                    自动
                  </button>
                  {currentCompositionOptions.map((composition) => {
                    const Icon = compositionIcons[composition];
                    return (
                      <button
                        className={currentComposition === composition && currentCompositionOverride ? "composition-pill composition-pill--active" : "composition-pill"}
                        data-testid={`composition-${composition}`}
                        key={composition}
                        onClick={() => updateSlideComposition(composition)}
                        title={compositionLabels[composition]}
                        type="button"
                      >
                        <Icon size={15} />
                      {compositionLabels[composition]}
                    </button>
                  );
                  })}
                </div>

                <div className="preview-toolbar-group preview-toolbar-group--text-flow" aria-label="Text flow">
                  <Columns2 size={16} />
                  <span>文本列</span>
                  {(["auto", "one", "two", "three", "grid"] as const).map((mode) => (
                    <button
                      className={currentTextFlow === mode ? "composition-pill composition-pill--active" : "composition-pill"}
                      data-testid={`text-flow-${mode}`}
                      key={mode}
                      onClick={() => updateSlideTextFlow(mode)}
                      type="button"
                    >
                      {textFlowLabels[mode]}
                    </button>
                  ))}
                </div>

                <div className="preview-toolbar-group preview-toolbar-group--health" aria-label="Slide health">
                  <Sparkles size={16} />
                  <span>本页</span>
                  <button className="composition-pill" data-testid="check-current-slide" onClick={handleCheckCurrentSlide} type="button">
                    检查
                  </button>
                  <button className="composition-pill" data-testid="beautify-current-slide" onClick={handleBeautifyCurrentSlide} type="button">
                    美化
                  </button>
                </div>

                <div className="preview-toolbar-group preview-toolbar-group--logo" aria-label="Deck logo">
                  <ImagePlus size={16} />
                  <span>Logo</span>
                  <label
                    className="composition-pill"
                    data-testid="select-brand-logo-button"
                    role="button"
                    title="Upload logo"
                  >
                    <ImagePlus size={15} />
                    {brandLogoAsset ? "更换" : "上传"}
                    <input
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      aria-label="Choose logo file"
                      className="visually-hidden-file-input"
                      data-testid="brand-logo-file-input"
                      name="brand-logo-upload"
                      onChange={handleBrandLogoInput}
                      type="file"
                    />
                  </label>
                  <button
                    className={draft.brandLogo?.position === "top-left" ? "composition-pill composition-pill--active" : "composition-pill"}
                    data-testid="brand-logo-position-top-left"
                    disabled={!draft.brandLogo}
                    onClick={() => updateBrandLogoPosition("top-left")}
                    type="button"
                  >
                    左上
                  </button>
                  <button
                    className={draft.brandLogo?.position !== "top-left" && draft.brandLogo ? "composition-pill composition-pill--active" : "composition-pill"}
                    data-testid="brand-logo-position-top-right"
                    disabled={!draft.brandLogo}
                    onClick={() => updateBrandLogoPosition("top-right")}
                    type="button"
                  >
                    右上
                  </button>
                  {draft.brandLogo ? (
                    <button className="composition-pill" data-testid="remove-brand-logo" onClick={removeBrandLogo} type="button">
                      移除
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="slide-controls">
              <button aria-label="Undo" data-testid="undo-edit" disabled={!canUndo} onClick={undoEdit} title="撤销" type="button">
                <Undo2 size={15} />
              </button>
              <button aria-label="Redo" data-testid="redo-edit" disabled={!canRedo} onClick={redoEdit} title="重做" type="button">
                <Redo2 size={15} />
              </button>
              <button onClick={() => setActiveSlide((slide) => Math.max(slide - 1, 0))} type="button">
                <ChevronLeft size={16} />
              </button>
              <span>
                {activeSlide + 1} / {deck.slides.length}
              </span>
              <button
                aria-label="Next slide"
                onClick={() => setActiveSlide((slide) => Math.min(slide + 1, deck.slides.length - 1))}
                type="button"
              >
                <ChevronRight size={16} />
              </button>
              {canResetImageLayout ? (
                <button className="slide-reset-button" onClick={resetCurrentImageLayout} type="button">
                  Reset image layout
                </button>
              ) : null}
              {canResetTextLayout ? (
                <button className="slide-reset-button" onClick={resetCurrentTextLayout} type="button">
                  Reset text layout
                </button>
              ) : null}
              {canAlignSelectedImages || canAlignSelectedTextBlocks ? (
                <SelectionAlignToolbar
                  count={canAlignSelectedImages ? selectedImageAssetIds.length : selectedTextBlockIds.length}
                  kind={canAlignSelectedImages ? "图片" : "文本"}
                  onAlign={alignSelectedObjects}
                />
              ) : null}
            </div>
          </div>

          <div
            className="slide-preview-stage"
            data-testid="slide-preview-stage"
            ref={previewStageRef}
            style={
              {
                "--preview-scale": previewScale,
                "--preview-slide-width": `${previewSlideBaseWidth}px`,
                "--preview-slide-height": `${previewSlideBaseHeight}px`
              } as React.CSSProperties
            }
          >
            <div className="slide-preview-scale" data-testid="slide-preview-scale">
              <SlideCanvas
                brandLogoAsset={brandLogoAsset}
                brandLogoPosition={draft.brandLogo?.position}
                compositionOverride={currentCompositionOverride}
                editable
                imageLayouts={draft.imageLayouts}
                onImageLayoutChange={updateImageLayout}
                onImageLayoutsChange={updateImageLayouts}
                onImageLayoutCommit={() => setStatus("Image layout saved")}
                onImageSelectionChange={setSelectedImageAssetIds}
                onTextLayoutChange={updateTextLayout}
                onTextLayoutsChange={updateTextLayouts}
                onTextLayoutCommit={() => setStatus("Text layout saved")}
                onTextBlockSelect={selectTextBlock}
                onTextSelectionChange={updateTextSelection}
                onTextBlockDeselect={deselectTextBlock}
                selectedImageAssetIds={selectedImageAssetIds}
                selectedTextBlock={selectedTextBlock}
                selectedTextBlockIds={selectedTextBlockIds}
                selectedTextLayout={currentSelectedTextLayout}
                slide={currentSlide}
                textFlow={currentTextFlow}
                textLayout={draft.textLayouts[currentSlide.id]}
              />
            </div>
          </div>

          {selectedTextBlock ? (
            <TextStyleToolbar
              block={selectedTextBlock}
              layout={currentSelectedTextLayout}
              onStyleChange={updateSelectedTextStyle}
            />
          ) : null}

          <SpeakerNotesPanel
            isCollapsed={isNotesPanelCollapsed}
            note={currentSpeakerNote}
            revealPlan={currentRevealPlan}
            slideIndex={activeSlide}
            slideIntent={currentSlideIntent}
            totalSlides={deck.slides.length}
            onNoteChange={updateCurrentSpeakerNote}
            onToggle={() => setIsNotesPanelCollapsed((collapsed) => !collapsed)}
          />

          <div className="thumbs" aria-label="Slides">
            {deck.slides.map((slide) => (
              <div className={slide.index === activeSlide ? "thumb-shell thumb-shell--active" : "thumb-shell"} key={slide.id}>
                <button
                  className={slide.index === activeSlide ? "thumb thumb--active" : "thumb"}
                  onClick={() => setActiveSlide(slide.index)}
                  type="button"
                >
                  <span>{String(slide.index + 1).padStart(2, "0")}</span>
                  {slide.title}
                </button>
                {slide.index === activeSlide ? (
                  <button
                    aria-label="复制本页"
                    className="thumb-copy-button"
                    data-testid="duplicate-slide"
                    onClick={duplicateCurrentSlide}
                    title="复制本页"
                    type="button"
                  >
                    <Copy size={14} strokeWidth={2.2} />
                    <span>复制本页</span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </main>

      {isDocumentLibraryOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-label="Document library" className="document-panel" role="dialog">
            <button aria-label="Close document library" className="panel-close" onClick={() => setIsDocumentLibraryOpen(false)} type="button">
              <X size={18} />
            </button>
            <div>
              <span className="eyebrow">Documents</span>
              <h2>本地 PPT 文档库</h2>
              <p>文档自动保存在当前浏览器。重要课件建议导出项目文件备份。</p>
            </div>
            <div className="document-panel-actions">
              <button className="primary-button" data-testid="create-document" onClick={createLocalDocument} type="button">
                <FileInput size={16} />
                新建 PPT
              </button>
              <button className="icon-button" onClick={() => projectImportInputRef.current?.click()} type="button">
                <FileInput size={16} />
                导入项目
              </button>
              <input
                accept=".json,.ai-ppt.json,application/json"
                className="visually-hidden-file-input"
                data-testid="project-import-input"
                onChange={handleProjectImport}
                ref={projectImportInputRef}
                type="file"
              />
            </div>
            <div className="document-list">
              {documentLibrary.documents.map((documentItem) => (
                <article
                  className={
                    documentItem.id === documentLibrary.activeDocumentId ? "document-card document-card--active" : "document-card"
                  }
                  key={documentItem.id}
                >
                  <button
                    className="document-card-main"
                    data-testid={`open-document-${documentItem.id}`}
                    onClick={() => void openDocument(documentItem.id)}
                    type="button"
                  >
                    <strong>{documentItem.title}</strong>
                    <span>{formatStorageSize(documentItem.estimatedSizeBytes)} · {new Date(documentItem.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <div className="document-card-actions">
                    <button onClick={() => renameLocalDocument(documentItem.id)} type="button">重命名</button>
                    <button onClick={() => void duplicateLocalDocument(documentItem.id)} type="button">复制</button>
                    <button onClick={() => exportProjectDocument(documentItem.id)} type="button">导出</button>
                    <button
                      aria-label={`Delete ${documentItem.title}`}
                      disabled={documentLibrary.documents.length <= 1}
                      onClick={() => void deleteLocalDocument(documentItem.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <p className="document-panel-note">本地库不等于云端备份；清理浏览器数据可能导致文档丢失。</p>
          </section>
        </div>
      ) : null}

      {isGeneratePanelOpen ? (
        <GenerateDeckPanel
          onClose={() => setIsGeneratePanelOpen(false)}
          onGenerateDeck={handleGenerateDeck}
          onGenerateOutline={async (input) => {
            setStatus("正在设计课程结构...");
            return generateOutline(input);
          }}
        />
      ) : null}

      {isImagePanelOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-label="Insert image"
            className="image-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleImageDrop}
            onPaste={handleImagePaste}
            ref={imagePanelRef}
            role="dialog"
            tabIndex={-1}
          >
            <button
              aria-label="Close image panel"
              className="panel-close"
              onClick={() => setIsImagePanelOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
            <div>
              <span className="eyebrow">Image</span>
              <h2>Insert Local Image</h2>
              <p>Choose up to 9 images and they will be added to the current slide. Markdown stays short with asset references.</p>
            </div>
            <div className="image-dropzone">
              <button
                className="image-upload-button"
                data-testid="select-image-button"
                onClick={() => imageFileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus size={17} />
                Select image
              </button>
              <input
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Choose image file"
                className="visually-hidden-file-input"
                data-testid="image-file-input"
                multiple
                name="image-upload"
                onChange={handleInsertImage}
                ref={imageFileInputRef}
                type="file"
              />
              <p>Or drag images here, or paste copied images.</p>
            </div>
            <div className="image-panel-actions">
              <button className="icon-button" onClick={() => setIsImagePanelOpen(false)} type="button">
                Cancel
              </button>
            </div>
            <p className="image-panel-status">{imageInsertStatus}</p>
          </section>
        </div>
      ) : null}

      {isSingleWindowPresentation ? (
        <div className="presentation" role="dialog" aria-label="Presentation preview">
          <button className="presentation-close" onClick={stopPresentation} type="button">
            Exit
          </button>
          <SlideCanvas
            brandLogoAsset={brandLogoAsset}
            brandLogoPosition={draft.brandLogo?.position}
            compositionOverride={currentCompositionOverride}
            isPresenting
            revealStep={revealStep}
            slide={currentSlide}
            textLayout={draft.textLayouts[currentSlide.id]}
          />
          <div className="presentation-footer">
            <span>{currentSlide.title}</span>
            <span>
              {activeSlide + 1} / {deck.slides.length}
            </span>
          </div>
        </div>
      ) : null}

      {isSpeakerMode ? (
        <PresenterConsole
          audienceWindowClosed={audienceWindowClosed}
          brandLogoAsset={brandLogoAsset}
          brandLogoPosition={draft.brandLogo?.position}
          currentCompositionOverride={currentCompositionOverride}
          currentRevealPlan={currentRevealPlan}
          currentSlide={currentSlide}
          currentSlideIntent={currentSlideIntent}
          currentSpeakerNote={currentSpeakerNote}
          nextSlide={nextSlide}
          nextSlideCompositionOverride={nextSlide ? draft.slideCompositions[nextSlide.id] : undefined}
          nextSlideTextLayout={nextSlide ? draft.textLayouts[nextSlide.id] : undefined}
          onAdvance={advanceRevealOrSlide}
          onExit={stopPresentation}
          onReopenAudience={reopenAudienceWindow}
          onRetreat={retreatRevealOrSlide}
          presentationStartedAt={presentationStartedAt}
          revealStep={revealStep}
          slideIndex={activeSlide}
          textLayout={draft.textLayouts[currentSlide.id]}
          totalSlides={deck.slides.length}
        />
      ) : null}
    </div>
  );
}

function AudiencePresentationView({
  brandLogoAsset,
  brandLogoPosition,
  currentCompositionOverride,
  currentSlide,
  deckLength,
  isEnded,
  revealStep,
  slideIndex,
  textLayout
}: {
  brandLogoAsset?: DeckAsset;
  brandLogoPosition?: BrandLogoPosition;
  currentCompositionOverride?: SlideComposition;
  currentSlide: Slide;
  deckLength: number;
  isEnded: boolean;
  revealStep: number;
  slideIndex: number;
  textLayout?: SlideTextLayout;
}) {
  if (isEnded) {
    return (
      <div className="audience-ended" data-testid="audience-ended">
        <h1>演示已结束</h1>
        <p>可以关闭这个观众窗口。</p>
      </div>
    );
  }
  return (
    <div className="audience-presentation" data-testid="audience-presentation">
      <SlideCanvas
        brandLogoAsset={brandLogoAsset}
        brandLogoPosition={brandLogoPosition}
        compositionOverride={currentCompositionOverride}
        isPresenting
        revealStep={revealStep}
        slide={currentSlide}
        textLayout={textLayout}
      />
      <div className="presentation-footer">
        <span>{currentSlide.title}</span>
        <span>{slideIndex + 1} / {deckLength}</span>
      </div>
    </div>
  );
}

function PresenterConsole({
  audienceWindowClosed,
  brandLogoAsset,
  brandLogoPosition,
  currentCompositionOverride,
  currentRevealPlan,
  currentSlide,
  currentSlideIntent,
  currentSpeakerNote,
  nextSlide,
  nextSlideCompositionOverride,
  nextSlideTextLayout,
  onAdvance,
  onExit,
  onReopenAudience,
  onRetreat,
  presentationStartedAt,
  revealStep,
  slideIndex,
  textLayout,
  totalSlides
}: {
  audienceWindowClosed: boolean;
  brandLogoAsset?: DeckAsset;
  brandLogoPosition?: BrandLogoPosition;
  currentCompositionOverride?: SlideComposition;
  currentRevealPlan: string;
  currentSlide: Slide;
  currentSlideIntent: string;
  currentSpeakerNote: string;
  nextSlide?: Slide;
  nextSlideCompositionOverride?: SlideComposition;
  nextSlideTextLayout?: SlideTextLayout;
  onAdvance: () => void;
  onExit: () => void;
  onReopenAudience: () => void;
  onRetreat: () => void;
  presentationStartedAt?: number;
  revealStep: number;
  slideIndex: number;
  textLayout?: SlideTextLayout;
  totalSlides: number;
}) {
  return (
    <div className="presenter-console" data-testid="presenter-console" role="dialog" aria-label="Presenter console">
      <section className="presenter-console__current">
        <SlideCanvas
          brandLogoAsset={brandLogoAsset}
          brandLogoPosition={brandLogoPosition}
          compositionOverride={currentCompositionOverride}
          isPresenting
          revealStep={revealStep}
          slide={currentSlide}
          textLayout={textLayout}
        />
      </section>
      <aside className="presenter-console__side">
        <div className="presenter-console__next" data-testid="presenter-next-slide">
          <span className="eyebrow">Next</span>
          {nextSlide && nextSlide.index !== currentSlide.index ? (
            <SlideCanvas
              brandLogoAsset={brandLogoAsset}
              brandLogoPosition={brandLogoPosition}
              compositionOverride={nextSlideCompositionOverride}
              isPresenting
              revealStep={0}
              slide={nextSlide}
              textLayout={nextSlideTextLayout}
            />
          ) : (
            <p>最后一页</p>
          )}
        </div>
        <div className="presenter-console__notes">
          <span className="eyebrow">Speaker Notes</span>
          <p data-testid="presenter-speaker-note">{currentSpeakerNote || "这一页还没有讲稿，可以回到编辑模式补充。"}</p>
          <span className="eyebrow">Intent</span>
          <p data-testid="presenter-slide-intent">{currentSlideIntent || "暂无设计意图。"}</p>
          <span className="eyebrow">Reveal</span>
          <p data-testid="presenter-reveal-plan">{currentRevealPlan || "默认按段落和图片逐步出现。"}</p>
        </div>
      </aside>
      <footer className="presenter-console__controls">
        <button onClick={onRetreat} type="button">上一步</button>
        <button data-testid="presenter-next-step" onClick={onAdvance} type="button">下一步</button>
        <strong>{slideIndex + 1} / {totalSlides}</strong>
        <PresenterTimer startedAt={presentationStartedAt} />
        {audienceWindowClosed ? (
          <button data-testid="reopen-audience-window" onClick={onReopenAudience} type="button">重新打开观众窗口</button>
        ) : null}
        <button data-testid="exit-speaker-mode" onClick={onExit} type="button">退出</button>
      </footer>
    </div>
  );
}

function PresenterTimer({ startedAt }: { startedAt?: number }) {
  const timerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function updateTimer() {
      if (!timerRef.current) return;
      const seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      timerRef.current.textContent = formatElapsedTime(seconds);
    }

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="presenter-timer" data-testid="presenter-timer" aria-label="演讲计时">
      <span className="presenter-timer__label">LIVE TIMER</span>
      <span className="presenter-timer__value" ref={timerRef}>00:00</span>
    </div>
  );
}

function SpeakerNotesPanel({
  isCollapsed,
  note,
  onNoteChange,
  onToggle,
  revealPlan,
  slideIndex,
  slideIntent,
  totalSlides
}: {
  isCollapsed: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onToggle: () => void;
  revealPlan: string;
  slideIndex: number;
  slideIntent: string;
  totalSlides: number;
}) {
  return (
    <aside className={isCollapsed ? "speaker-notes speaker-notes--collapsed" : "speaker-notes"} data-testid="speaker-notes-panel">
      <button
        aria-expanded={!isCollapsed}
        className="speaker-notes__toggle"
        data-testid="toggle-speaker-notes"
        onClick={onToggle}
        type="button"
      >
        讲稿
        <span>{slideIndex + 1} / {totalSlides}</span>
      </button>
      {isCollapsed ? null : (
        <div className="speaker-notes__body">
          <div>
            <span className="eyebrow">Slide Intent</span>
            <p data-testid="slide-intent">{slideIntent || "这一页还没有设计意图。"}</p>
          </div>
          <div>
            <span className="eyebrow">Reveal Rhythm</span>
            <p data-testid="slide-reveal-plan">{revealPlan || "默认按段落和图片逐步出现。"}</p>
          </div>
          <label>
            <span>当前页讲稿</span>
            <textarea
              data-testid="speaker-note-editor"
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="这里可以写你讲这一页时要说的话。"
              value={note}
            />
          </label>
        </div>
      )}
    </aside>
  );
}

function GenerateDeckPanel({
  onClose,
  onGenerateDeck,
  onGenerateOutline
}: {
  onClose: () => void;
  onGenerateDeck: (input: GenerateOutlineInput, outline: GeneratedOutline) => Promise<void>;
  onGenerateOutline: (input: GenerateOutlineInput) => Promise<GeneratedOutline>;
}) {
  const [input, setInput] = useState<GenerateOutlineInput>({
    topic: "",
    scenario: "lesson",
    audience: "小白用户",
    slideCount: 6,
    tone: "清晰教学",
    sourceMaterial: ""
  });
  const [outline, setOutline] = useState<GeneratedOutline | undefined>(undefined);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [message, setMessage] = useState("先输入主题，AI 会先给你一份可修改的大纲。");
  const isBusy = isGeneratingOutline || isGeneratingDeck;

  useEffect(() => {
    if (!isBusy) {
      setWaitingSeconds(0);
      return;
    }
    setWaitingSeconds(0);
    const timer = window.setInterval(() => setWaitingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isBusy]);

  async function submitOutline() {
    if (!input.topic.trim()) {
      setMessage("请先填写课件主题。");
      return;
    }

    setIsGeneratingOutline(true);
    setMessage("正在生成第 1 版大纲...");
    try {
      const result = await onGenerateOutline({
        ...input,
        topic: input.topic.trim(),
        audience: input.audience.trim() || "小白用户",
        tone: input.tone.trim() || "清晰教学",
        sourceMaterial: input.sourceMaterial?.trim()
      });
      setOutline(result);
      setMessage(`已生成 ${result.slides.length} 页大纲，可以先改标题和要点。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 大纲生成失败。");
    } finally {
      setIsGeneratingOutline(false);
    }
  }

  async function submitDeck() {
    if (!outline) return;
    setIsGeneratingDeck(true);
    setMessage("正在把大纲变成可编辑 PPT...");
    try {
      await onGenerateDeck(input, outline);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI PPT 生成失败。");
    } finally {
      setIsGeneratingDeck(false);
    }
  }

  function updateOutlineSlide(slideId: string, patch: Partial<GeneratedOutlineSlide>) {
    setOutline((current) =>
      current
        ? {
            ...current,
            slides: current.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide))
          }
        : current
    );
  }

  function removeOutlineSlide(slideId: string) {
    setOutline((current) => (current ? { ...current, slides: current.slides.filter((slide) => slide.id !== slideId) } : current));
  }

  function addOutlineSlide() {
    setOutline((current) => {
      if (!current) return current;
      const nextIndex = current.slides.length + 1;
      return {
        ...current,
        slides: [
          ...current.slides,
          {
            id: `slide-${nextIndex}`,
            title: "新页面",
            bullets: ["补充这一页要讲的重点"],
            purpose: "method"
          }
        ]
      };
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label="AI deck generator" className="generate-panel" role="dialog">
        <button aria-label="Close AI deck generator" className="panel-close" disabled={isBusy} onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="generate-panel__header">
          <span className="eyebrow">AI Generator</span>
          <h2>AI 生成课件</h2>
          <p>输入主题和资料，先生成可修改大纲，再一键变成新的 PPT 文档。</p>
        </div>

        <div className="generate-form">
          <label>
            <span>课件主题</span>
            <input
              data-testid="generate-topic"
              disabled={isBusy}
              onChange={(event) => setInput((current) => ({ ...current, topic: event.target.value }))}
              placeholder="例如：给新员工讲 AI PPT 工具怎么用"
              value={input.topic}
            />
          </label>
          <div className="generate-form-grid">
            <label>
              <span>使用场景</span>
              <select
                data-testid="generate-scenario"
                disabled={isBusy}
                onChange={(event) => setInput((current) => ({ ...current, scenario: event.target.value as GenerateOutlineInput["scenario"] }))}
                value={input.scenario}
              >
                <option value="lesson">讲课</option>
                <option value="report">汇报</option>
                <option value="training">培训</option>
                <option value="pitch">路演</option>
                <option value="reading">读书分享</option>
              </select>
            </label>
            <label>
              <span>页数</span>
              <select
                data-testid="generate-slide-count"
                disabled={isBusy}
                onChange={(event) => setInput((current) => ({ ...current, slideCount: Number(event.target.value) }))}
                value={input.slideCount}
              >
                {[6, 8, 10, 12].map((count) => (
                  <option key={count} value={count}>
                    {count} 页
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>受众</span>
              <input
                disabled={isBusy}
                onChange={(event) => setInput((current) => ({ ...current, audience: event.target.value }))}
                value={input.audience}
              />
            </label>
            <label>
              <span>语气</span>
              <input
                disabled={isBusy}
                onChange={(event) => setInput((current) => ({ ...current, tone: event.target.value }))}
                value={input.tone}
              />
            </label>
          </div>
          <label>
            <span>补充资料</span>
            <textarea
              data-testid="generate-source-material"
              disabled={isBusy}
              onChange={(event) => setInput((current) => ({ ...current, sourceMaterial: event.target.value }))}
              placeholder="可以粘贴文章、会议记录、产品说明。没有资料也可以留空。"
              value={input.sourceMaterial}
            />
          </label>
          <div className="generate-actions">
            <button className="primary-button" data-testid="generate-outline" disabled={isGeneratingOutline || isGeneratingDeck} onClick={submitOutline} type="button">
              <Brain size={16} />
              {isGeneratingOutline ? "正在生成大纲" : outline ? "重新生成大纲" : "生成大纲"}
            </button>
            <span className={message.includes("失败") || message.includes("配置") || message.includes("请先") ? "generate-message generate-message--error" : "generate-message"}>
              {message}
            </span>
          </div>
        </div>

        {isBusy ? (
          <GeneratingStatus
            seconds={waitingSeconds}
            title={isGeneratingOutline ? "正在设计课程结构" : "正在生成可编辑 PPT"}
          />
        ) : null}

        {outline ? (
          <div className={isBusy ? "outline-editor outline-editor--busy" : "outline-editor"} data-testid="generated-outline">
            <div className="outline-editor__head">
              <div>
                <span className="eyebrow">Outline</span>
                <h3>{outline.title}</h3>
              </div>
              <button className="icon-button" disabled={isBusy} onClick={addOutlineSlide} type="button">
                <FileInput size={15} />
                加一页
              </button>
            </div>
            <div className="outline-list">
              {outline.slides.map((slide, index) => (
                <article className="outline-card" key={slide.id}>
                  <div className="outline-card__index">{String(index + 1).padStart(2, "0")}</div>
                  <label>
                    <span>标题</span>
                    <input
                      data-testid={`outline-title-${index}`}
                      disabled={isBusy}
                      onChange={(event) => updateOutlineSlide(slide.id, { title: event.target.value })}
                      value={slide.title}
                    />
                  </label>
                  <label>
                    <span>要点</span>
                    <textarea
                      data-testid={`outline-bullets-${index}`}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateOutlineSlide(slide.id, {
                          bullets: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
                        })
                      }
                      value={slide.bullets.join("\n")}
                    />
                  </label>
                  <button className="outline-card__remove" disabled={isBusy || outline.slides.length <= 1} onClick={() => removeOutlineSlide(slide.id)} type="button">
                    移除
                  </button>
                </article>
              ))}
            </div>
            <div className="generate-panel__footer">
              <button className="icon-button" disabled={isBusy} onClick={onClose} type="button">取消</button>
              <button className="primary-button" data-testid="generate-deck" disabled={isGeneratingDeck || isGeneratingOutline} onClick={submitDeck} type="button">
                <Sparkles size={16} />
                {isGeneratingDeck ? "正在生成 PPT" : "生成新的 PPT"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GeneratingStatus({ seconds, title }: { seconds: number; title: string }) {
  return (
    <div className="generating-status" data-testid="generating-status" role="status" aria-live="polite">
      <div className="generating-status__orb" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>{title}</strong>
        <p>AI 正在处理内容，已等待 {seconds} 秒</p>
      </div>
    </div>
  );
}

function TextStyleToolbar({
  block,
  layout,
  onStyleChange
}: {
  block: string;
  layout?: TextBlockLayout;
  onStyleChange: (style: TextBlockStyle) => void;
}) {
  const currentStyle = layout?.style ?? {};
  const defaults = defaultTextStyleForBlock(block);
  const fontSize = currentStyle.fontSize ?? defaults.fontSize;
  const isBold = currentStyle.bold ?? defaults.bold;
  const lineHeight = currentStyle.lineHeight ?? defaults.lineHeight;
  const letterSpacing = currentStyle.letterSpacing ?? defaults.letterSpacing;

  return (
    <div className="text-style-toolbar" data-testid="text-style-toolbar" aria-label="Text style toolbar">
      <span className="text-style-toolbar__label">文字</span>
      <button
        aria-label="Decrease font size"
        className="text-style-button"
        onClick={() => onStyleChange({ fontSize: fontSize - 4 })}
        type="button"
      >
        -
      </button>
      <span className="text-style-size">{fontSize}</span>
      <button
        aria-label="Increase font size"
        className="text-style-button"
        data-testid="text-font-size-increase"
        onClick={() => onStyleChange({ fontSize: fontSize + 4 })}
        type="button"
      >
        +
      </button>
      <select
        aria-label="Font family"
        className="text-style-select"
        onChange={(event) => onStyleChange({ fontFamily: event.target.value || undefined })}
        value={currentStyle.fontFamily ?? ""}
      >
        {textStyleFonts.map((font) => (
          <option key={font.value || "theme"} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <button
        aria-label="Toggle bold"
        className={isBold ? "text-style-button text-style-button--active" : "text-style-button"}
        data-testid="text-bold-toggle"
        onClick={() => onStyleChange({ bold: !isBold })}
        type="button"
      >
        B
      </button>
      <TextStyleStepper
        label="行距"
        value={lineHeight}
        valueText={lineHeight.toFixed(1)}
        decreaseLabel="Decrease line height"
        increaseLabel="Increase line height"
        increaseTestId="text-line-height-increase"
        onDecrease={() => onStyleChange({ lineHeight: lineHeight - 0.1 })}
        onIncrease={() => onStyleChange({ lineHeight: lineHeight + 0.1 })}
      />
      <TextStyleStepper
        label="字距"
        value={letterSpacing}
        valueText={formatTextStyleNumber(letterSpacing)}
        decreaseLabel="Decrease letter spacing"
        increaseLabel="Increase letter spacing"
        increaseTestId="text-letter-spacing-increase"
        onDecrease={() => onStyleChange({ letterSpacing: letterSpacing - 0.5 })}
        onIncrease={() => onStyleChange({ letterSpacing: letterSpacing + 0.5 })}
      />
      <div className="text-style-colors" aria-label="Text colors">
        {textStyleColors.map((color) => (
          <button
            aria-label={`Text color ${color}`}
            className={currentStyle.color === color ? "text-color-swatch text-color-swatch--active" : "text-color-swatch"}
            data-testid={`text-color-${color}`}
            key={color}
            onClick={() => onStyleChange({ color })}
            style={{ background: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

function SelectionAlignToolbar({
  count,
  kind,
  onAlign
}: {
  count: number;
  kind: "图片" | "文本";
  onAlign: (direction: AlignmentDirection) => void;
}) {
  return (
    <div className="selection-align-toolbar" data-testid="selection-align-toolbar" aria-label={`${kind}对齐工具`}>
      <span className="selection-align-toolbar__label">{count} 个</span>
      {selectionAlignmentControls.map(({ direction, icon: Icon, label, testId }) => (
        <button aria-label={label} data-testid={testId} key={direction} onClick={() => onAlign(direction)} title={label} type="button">
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function TextStyleStepper({
  label,
  value,
  valueText,
  decreaseLabel,
  increaseLabel,
  increaseTestId,
  onDecrease,
  onIncrease
}: {
  label: string;
  value: number;
  valueText: string;
  decreaseLabel: string;
  increaseLabel: string;
  increaseTestId: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="text-style-stepper" aria-label={label}>
      <span className="text-style-stepper__label">{label}</span>
      <button aria-label={decreaseLabel} className="text-style-button text-style-button--compact" onClick={onDecrease} type="button">
        -
      </button>
      <span className="text-style-size" data-value={value}>
        {valueText}
      </span>
      <button
        aria-label={increaseLabel}
        className="text-style-button text-style-button--compact"
        data-testid={increaseTestId}
        onClick={onIncrease}
        type="button"
      >
        +
      </button>
    </div>
  );
}

function formatTextStyleNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface SlideCanvasProps {
  brandLogoAsset?: DeckAsset;
  brandLogoPosition?: BrandLogoPosition;
  compositionOverride?: SlideComposition;
  editable?: boolean;
  imageLayouts?: Record<string, ImageLayout>;
  isPresenting?: boolean;
  onImageLayoutChange?: (assetId: string, layout: ImageLayout) => void;
  onImageLayoutsChange?: (layouts: Record<string, ImageLayout>) => void;
  onImageLayoutCommit?: () => void;
  onImageSelectionChange?: (assetIds: string[]) => void;
  onTextLayoutChange?: (block: string, layout: TextBlockLayout) => void;
  onTextLayoutsChange?: (layouts: Record<string, TextBlockLayout>) => void;
  onTextLayoutCommit?: () => void;
  onTextBlockSelect?: (block: string, layout: TextBlockLayout) => void;
  onTextSelectionChange?: (blockIds: string[], primaryBlockId?: string, primaryLayout?: TextBlockLayout) => void;
  onTextBlockDeselect?: () => void;
  revealStep?: number;
  selectedImageAssetIds?: string[];
  selectedTextBlock?: string;
  selectedTextBlockIds?: string[];
  selectedTextLayout?: TextBlockLayout;
  slide: Slide;
  textFlow?: SlideTextFlowMode;
  textLayout?: SlideTextLayout;
}

interface ImageInteraction {
  kind: "image";
  assetId: string;
  frame: HTMLElement;
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  latestClientX: number;
  latestClientY: number;
  baseLayout: ImageLayout;
  currentLayout: ImageLayout;
  groupFrames: Array<{ assetId: string; frame: HTMLElement }>;
  groupBaseLayouts: Record<string, ImageLayout>;
  groupCurrentLayouts: Record<string, ImageLayout>;
  slideRect: DOMRect;
  animationFrame: number | null;
}

interface TextInteraction {
  kind: "text";
  block: string;
  element: HTMLElement;
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  latestClientX: number;
  latestClientY: number;
  baseLayout: TextBlockLayout;
  currentLayout: TextBlockLayout;
  groupElements: Array<{ block: string; element: HTMLElement }>;
  groupBaseLayouts: Record<string, TextBlockLayout>;
  groupCurrentLayouts: Record<string, TextBlockLayout>;
  slideRect: DOMRect;
  animationFrame: number | null;
}

type CanvasInteraction = ImageInteraction | TextInteraction;

function SlideCanvas({
  brandLogoAsset,
  brandLogoPosition = "top-right",
  compositionOverride,
  editable = false,
  imageLayouts = {},
  isPresenting = false,
  onImageLayoutChange,
  onImageLayoutsChange,
  onImageLayoutCommit,
  onImageSelectionChange,
  onTextLayoutChange,
  onTextLayoutsChange,
  onTextLayoutCommit,
  onTextBlockSelect,
  onTextSelectionChange,
  onTextBlockDeselect,
  revealStep = 0,
  selectedImageAssetIds = [],
  selectedTextBlock,
  selectedTextBlockIds = [],
  selectedTextLayout,
  slide,
  textFlow = "auto",
  textLayout = {}
}: SlideCanvasProps) {
  const canvasRef = useRef<HTMLElement | null>(null);
  const interactionRef = useRef<CanvasInteraction | null>(null);
  const cleanupWindowPointerRef = useRef<(() => void) | null>(null);
  const sourceHtml = isPresenting ? annotateRevealItems(slide.html, revealStep) : slide.html;
  const baseSlideContentHtml = removeFreeImageFrames(sourceHtml);
  const freeImageHtml = markSelectedImageFrames(extractFreeImageFrames(sourceHtml), selectedImageAssetIds);
  const textBlocks = splitSlideTextBlocks(baseSlideContentHtml);
  const composition = getSlideComposition(slide, compositionOverride);
  const bodyLayoutBlocksFlow = textFlow !== "auto";
  const hasLegacyBodyLayout = Boolean(textLayout.body && !bodyLayoutBlocksFlow);
  const logoClass = brandLogoAsset ? ` slide-canvas--logo-${brandLogoPosition}` : "";
  const presentingClass = isPresenting ? " slide-canvas--presenting" : "";
  const revealCount = isPresenting ? countRevealItems(slide.html) : 0;

  useEffect(() => {
    return () => cleanupWindowPointerRef.current?.();
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!editable) return;
    const target = event.target as HTMLElement;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = target.closest<HTMLElement>(".slide-image-frame[data-asset-id]");

    if (frame && onImageLayoutChange) {
      const assetId = frame.dataset.assetId;
      if (!assetId) return;

      event.preventDefault();
      event.stopPropagation();
      onTextBlockDeselect?.();
      onTextSelectionChange?.([]);
      cleanupWindowPointerRef.current?.();
      if ((event.ctrlKey || event.metaKey) && !target.closest(".image-resize-handle")) {
        onImageSelectionChange?.(toggleSelectedAssetId(selectedImageAssetIds, assetId));
        return;
      }

      const slideRect = canvas.getBoundingClientRect();
      const isResize = Boolean(target.closest(".image-resize-handle"));
      const movingAssetIds =
        !isResize && selectedImageAssetIds.length > 1 && selectedImageAssetIds.includes(assetId) ? selectedImageAssetIds : [assetId];
      const groupFrames = movingAssetIds
        .map((selectedAssetId) => ({
          assetId: selectedAssetId,
          frame: canvas.querySelector<HTMLElement>(`.slide-image-frame[data-asset-id="${cssEscape(selectedAssetId)}"]`)
        }))
        .filter((item): item is { assetId: string; frame: HTMLElement } => Boolean(item.frame));
      const groupBaseLayouts = Object.fromEntries(
        groupFrames.map((item) => [item.assetId, readFrameLayout(item.frame, slideRect, imageLayouts[item.assetId])])
      );
      onImageSelectionChange?.(movingAssetIds);
      interactionRef.current = {
        kind: "image",
        assetId,
        frame,
        mode: isResize ? "resize" : "move",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        latestClientX: event.clientX,
        latestClientY: event.clientY,
        baseLayout: readFrameLayout(frame, slideRect, imageLayouts[assetId]),
        currentLayout: readFrameLayout(frame, slideRect, imageLayouts[assetId]),
        groupFrames,
        groupBaseLayouts,
        groupCurrentLayouts: groupBaseLayouts,
        slideRect,
        animationFrame: null
      };
      startWindowPointerTracking(
        event.pointerId,
        onImageLayoutChange,
        onImageLayoutsChange,
        onImageLayoutCommit,
        onTextLayoutChange,
        onTextLayoutsChange,
        onTextLayoutCommit
      );
      return;
    }

    const textElement = target.closest<HTMLElement>(".slide-text-block[data-text-block]");
    const textBlock = textElement?.dataset.textBlock;
    if (!textBlock || !textElement || !onTextLayoutChange) {
      onTextBlockDeselect?.();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cleanupWindowPointerRef.current?.();
    const slideRect = canvas.getBoundingClientRect();
    const storedTextLayout = getTextLayoutForBlock(textLayout, textBlock) ?? (selectedTextBlock === textBlock ? selectedTextLayout : undefined);
    const baseTextLayout = readTextBlockLayout(textElement, slideRect, storedTextLayout);
    const isResize = Boolean(target.closest(".text-resize-handle"));
    if ((event.ctrlKey || event.metaKey) && !isResize) {
      const nextSelectedTextBlockIds = toggleSelectedAssetId(selectedTextBlockIds, textBlock);
      onTextSelectionChange?.(nextSelectedTextBlockIds, textBlock, baseTextLayout);
      onImageSelectionChange?.([]);
      return;
    }

    const movingTextBlockIds =
      !isResize && selectedTextBlockIds.length > 1 && selectedTextBlockIds.includes(textBlock) ? selectedTextBlockIds : [textBlock];
    const groupElements = movingTextBlockIds
      .map((block) => ({
        block,
        element: canvas.querySelector<HTMLElement>(`.slide-text-block[data-text-block="${cssEscape(block)}"]`)
      }))
      .filter((item): item is { block: string; element: HTMLElement } => Boolean(item.element));
    const groupBaseLayouts = Object.fromEntries(
      groupElements.map((item) => [item.block, readTextBlockLayout(item.element, slideRect, getTextLayoutForBlock(textLayout, item.block))])
    );
    onTextSelectionChange?.(movingTextBlockIds, textBlock, baseTextLayout);
    interactionRef.current = {
      kind: "text",
      block: textBlock,
      element: textElement,
      mode: isResize ? "resize" : "move",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      baseLayout: baseTextLayout,
      currentLayout: baseTextLayout,
      groupElements,
      groupBaseLayouts,
      groupCurrentLayouts: groupBaseLayouts,
      slideRect,
      animationFrame: null
    };
    onImageSelectionChange?.([]);
    startWindowPointerTracking(
      event.pointerId,
      onImageLayoutChange,
      onImageLayoutsChange,
      onImageLayoutCommit,
      onTextLayoutChange,
      onTextLayoutsChange,
      onTextLayoutCommit
    );
  }

  function startWindowPointerTracking(
    pointerId: number,
    imageLayoutChange: SlideCanvasProps["onImageLayoutChange"],
    imageLayoutsChange: SlideCanvasProps["onImageLayoutsChange"],
    imageLayoutCommit: SlideCanvasProps["onImageLayoutCommit"],
    textLayoutChange: SlideCanvasProps["onTextLayoutChange"],
    textLayoutsChange: SlideCanvasProps["onTextLayoutsChange"],
    textLayoutCommit: SlideCanvasProps["onTextLayoutCommit"]
  ) {
    const onWindowPointerMove = (moveEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== moveEvent.pointerId || interaction.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      interaction.latestClientX = moveEvent.clientX;
      interaction.latestClientY = moveEvent.clientY;
      if (interaction.animationFrame !== null) return;
      interaction.animationFrame = window.requestAnimationFrame(() => {
        const current = interactionRef.current;
        if (!current) return;
        current.animationFrame = null;
        applyInteractionLayout(current);
      });
    };

    const onWindowPointerUp = (upEvent: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== upEvent.pointerId || interaction.pointerId !== pointerId) return;
      upEvent.preventDefault();
      if (interaction.animationFrame !== null) {
        window.cancelAnimationFrame(interaction.animationFrame);
        interaction.animationFrame = null;
      }
      interaction.latestClientX = upEvent.clientX;
      interaction.latestClientY = upEvent.clientY;
      const didMove = interactionMoved(interaction);
      if (didMove) {
        applyInteractionLayout(interaction);
      }
      interactionRef.current = null;
      cleanupWindowPointerRef.current?.();
      if (interaction.kind === "image") {
        if (interaction.mode === "move" && Object.keys(interaction.groupCurrentLayouts).length > 1) {
          imageLayoutsChange?.(interaction.groupCurrentLayouts);
        } else {
          imageLayoutChange?.(interaction.assetId, interaction.currentLayout);
        }
        imageLayoutCommit?.();
      } else {
        if (didMove) {
          if (interaction.mode === "move" && Object.keys(interaction.groupCurrentLayouts).length > 1) {
            textLayoutsChange?.(interaction.groupCurrentLayouts);
          } else {
            textLayoutChange?.(interaction.block, interaction.currentLayout);
          }
          textLayoutCommit?.();
        }
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      cleanupWindowPointerRef.current = null;
    };
    cleanupWindowPointerRef.current = cleanup;

    window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", onWindowPointerUp, { passive: false });
    window.addEventListener("pointercancel", onWindowPointerUp, { passive: false });
  }

  const titleFlowLayout = isFreeTextLayout(textLayout.title) ? undefined : (textLayout.title as TextBlockLayout | undefined);
  const titleFreeLayout = isFreeTextLayout(textLayout.title) ? textLayout.title : undefined;

  return (
    <article
      className={`slide-canvas slide-canvas--${slide.layout} slide-composition--${composition}${logoClass}${presentingClass} ${editable ? "slide-canvas--editable" : ""}`}
      data-reveal-count={isPresenting ? revealCount : undefined}
      data-reveal-step={isPresenting ? revealStep : undefined}
      onPointerDown={onPointerDown}
      ref={canvasRef}
    >
      <div className="slide-number">{String(slide.index + 1).padStart(2, "0")}</div>
      {brandLogoAsset ? (
        <img className={`slide-logo slide-logo--${brandLogoPosition}`} src={brandLogoAsset.dataUrl} alt={brandLogoAsset.name} />
      ) : null}
      <div className="slide-content">
        {textBlocks.titleHtml && !titleFreeLayout ? (
          <div
            className="slide-text-block slide-text-block--title"
            data-text-block="title"
            data-text-selected={selectedTextBlockIds.includes("title") ? "true" : undefined}
            data-text-style={titleFlowLayout?.style ? "custom" : undefined}
            dangerouslySetInnerHTML={{ __html: textBlocks.titleHtml }}
            style={textStyleOnlyBlockStyle(titleFlowLayout)}
          />
        ) : null}
        {textBlocks.bodyBlocks.length > 0 && !hasLegacyBodyLayout ? (
          <div className={`slide-text-flow slide-text-flow--${textFlow}`}>
            {textBlocks.bodyBlocks.map((block) =>
                !isFreeTextLayout(textLayout.blocks?.[block.id]) ? (
                  <div
                    className={`slide-text-block slide-text-block--body slide-text-block--content slide-text-block--${block.kind}`}
                    data-text-block={block.id}
                    data-text-selected={selectedTextBlockIds.includes(block.id) ? "true" : undefined}
                    data-text-style={textLayout.blocks?.[block.id]?.style ? "custom" : undefined}
                    data-text-block-kind={block.kind}
                    dangerouslySetInnerHTML={{ __html: block.html }}
                    key={block.id}
                    style={textStyleOnlyBlockStyle(textLayout.blocks?.[block.id])}
                  />
                ) : null
            )}
          </div>
        ) : null}
      </div>
      {textBlocks.titleHtml && titleFreeLayout ? (
        <div className="slide-text-layer">
          <div
            className="slide-text-block slide-text-block--title"
            data-text-block="title"
            data-text-layout="free"
            data-text-selected={selectedTextBlockIds.includes("title") ? "true" : undefined}
            data-text-style={titleFreeLayout.style ? "custom" : undefined}
            style={textBlockStyle(titleFreeLayout, editable)}
          >
            <span className="slide-text-block-html" dangerouslySetInnerHTML={{ __html: textBlocks.titleHtml }} />
            {editable ? <span aria-label="Resize text line length" className="text-resize-handle" role="slider" /> : null}
          </div>
        </div>
      ) : textBlocks.titleHtml &&
        selectedTextBlockIds.length === 1 &&
        selectedTextBlockIds.includes("title") &&
        isFreeTextLayout(selectedTextLayout) ? (
        <div className="slide-text-layer">
          <div
            className="slide-text-block slide-text-block--title"
            data-text-block="title"
            data-text-layout="free"
            data-text-selected="true"
            data-text-style={selectedTextLayout.style ? "custom" : undefined}
            style={textBlockStyle(selectedTextLayout, editable)}
          >
            <span className="slide-text-block-html" dangerouslySetInnerHTML={{ __html: textBlocks.titleHtml }} />
            {editable ? <span aria-label="Resize text line length" className="text-resize-handle" role="slider" /> : null}
          </div>
        </div>
      ) : null}
      {textBlocks.bodyBlocks.length > 0 ? (
        <div className="slide-text-layer">
          {textBlocks.bodyBlocks.map((block) => {
            const layout = textLayout.blocks?.[block.id];
            if (!isFreeTextLayout(layout)) {
              if (hasLegacyBodyLayout || (selectedTextBlockIds.length === 1 && selectedTextBlock === block.id)) return null;
              return null;
            }
            return (
              <div
                className={`slide-text-block slide-text-block--body slide-text-block--${block.kind}`}
                data-text-block={block.id}
                data-text-layout="free"
                data-text-flow={textFlow === "auto" ? undefined : textFlow}
                data-text-block-kind={block.kind}
                data-text-selected={selectedTextBlockIds.includes(block.id) ? "true" : undefined}
                data-text-style={layout.style ? "custom" : undefined}
                key={block.id}
                style={textBlockStyle(layout, editable)}
              >
                <span className="slide-text-block-html" dangerouslySetInnerHTML={{ __html: block.html }} />
                {editable ? <span aria-label="Resize text line length" className="text-resize-handle" role="slider" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {textBlocks.bodyHtml && textLayout.body && !bodyLayoutBlocksFlow && (
        <div className="slide-text-layer">
          <div
            className="slide-text-block slide-text-block--body"
            data-text-block="body"
            data-text-layout="free"
            data-text-selected={selectedTextBlockIds.includes("body") ? "true" : undefined}
            data-text-style={textLayout.body.style ? "custom" : undefined}
            style={textBlockStyle(textLayout.body, editable)}
          >
            <span className="slide-text-block-html" dangerouslySetInnerHTML={{ __html: textBlocks.bodyHtml }} />
            {editable ? <span aria-label="Resize text line length" className="text-resize-handle" role="slider" /> : null}
          </div>
        </div>
      )}
      {freeImageHtml ? <div className="slide-image-layer" dangerouslySetInnerHTML={{ __html: freeImageHtml }} /> : null}
    </article>
  );
}

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

function markSelectedImageFrames(html: string, selectedAssetIds: string[]): string {
  if (selectedAssetIds.length === 0) return html;
  const selectedAssetIdSet = new Set(selectedAssetIds);
  return html.replace(/<span\b(?=[^>]*\bslide-image-frame\b)(?=[^>]*\bdata-asset-id="([^"]+)")[^>]*>/g, (match, assetId) =>
    selectedAssetIdSet.has(assetId) ? match.replace("<span", '<span data-image-selected="true"') : match
  );
}

function toggleSelectedAssetId(selectedAssetIds: string[], assetId: string) {
  return selectedAssetIds.includes(assetId) ? selectedAssetIds.filter((selectedAssetId) => selectedAssetId !== assetId) : [...selectedAssetIds, assetId];
}

function interactionMoved(interaction: CanvasInteraction) {
  return interaction.latestClientX !== interaction.startClientX || interaction.latestClientY !== interaction.startClientY;
}

function applyInteractionLayout(interaction: CanvasInteraction) {
  const deltaX = ((interaction.latestClientX - interaction.startClientX) / interaction.slideRect.width) * 100;
  const deltaY = ((interaction.latestClientY - interaction.startClientY) / interaction.slideRect.height) * 100;
  if (interaction.kind === "text") {
    if (interaction.mode === "resize") {
      const leftEdge = interaction.baseLayout.x - (interaction.baseLayout.width ?? 24) / 2;
      const width = clampLayoutValue((interaction.baseLayout.width ?? 24) + deltaX, 8, 100);
      const nextLayout = normalizeTextBlockLayout({
        x: leftEdge + width / 2,
        y: interaction.baseLayout.y,
        mode: "free",
        width,
        style: interaction.baseLayout.style
      });

      interaction.currentLayout = nextLayout;
      applyTextBlockLayout(interaction.element, nextLayout);
      return;
    }

    const nextLayout = normalizeTextBlockLayout({
      x: interaction.baseLayout.x + deltaX,
      y: interaction.baseLayout.y + deltaY,
      mode: "free",
      width: interaction.baseLayout.width,
      style: interaction.baseLayout.style
    });

    if (Object.keys(interaction.groupBaseLayouts).length > 1) {
      const groupCurrentLayouts = Object.fromEntries(
        interaction.groupElements.map(({ block, element }) => {
          const baseLayout = interaction.groupBaseLayouts[block];
          const nextGroupLayout = normalizeTextBlockLayout({
            x: baseLayout.x + deltaX,
            y: baseLayout.y + deltaY,
            mode: "free",
            width: baseLayout.width,
            style: baseLayout.style
          });
          applyTextBlockLayout(element, nextGroupLayout);
          return [block, nextGroupLayout];
        })
      );
      interaction.groupCurrentLayouts = groupCurrentLayouts;
      interaction.currentLayout = groupCurrentLayouts[interaction.block] ?? nextLayout;
      return;
    }

    interaction.currentLayout = nextLayout;
    applyTextBlockLayout(interaction.element, nextLayout);
    return;
  }

  if (interaction.mode === "resize") {
    const nextLayout = normalizeImageLayout({
      ...interaction.baseLayout,
      width: interaction.baseLayout.width + deltaX
    });
    interaction.currentLayout = nextLayout;
    interaction.groupCurrentLayouts = { [interaction.assetId]: nextLayout };
    applyFrameLayout(interaction.frame, nextLayout);
    return;
  }

  const groupCurrentLayouts = Object.fromEntries(
    interaction.groupFrames.map(({ assetId, frame }) => {
      const baseLayout = interaction.groupBaseLayouts[assetId];
      const nextLayout = normalizeImageLayout({
        ...baseLayout,
        x: baseLayout.x + deltaX,
        y: baseLayout.y + deltaY
      });
      applyFrameLayout(frame, nextLayout);
      return [assetId, nextLayout];
    })
  );
  interaction.groupCurrentLayouts = groupCurrentLayouts;
  interaction.currentLayout = groupCurrentLayouts[interaction.assetId] ?? interaction.currentLayout;
}

function readFrameLayout(frame: HTMLElement, slideRect: DOMRect, storedLayout?: ImageLayout): ImageLayout {
  if (storedLayout) return storedLayout;
  const rect = frame.getBoundingClientRect();
  return normalizeImageLayout({
    x: ((rect.left + rect.width / 2 - slideRect.left) / slideRect.width) * 100,
    y: ((rect.top + rect.height / 2 - slideRect.top) / slideRect.height) * 100,
    width: (rect.width / slideRect.width) * 100
  });
}

function applyFrameLayout(frame: HTMLElement, layout: ImageLayout) {
  frame.dataset.imageLayout = "free";
  frame.style.setProperty("--image-x", `${layout.x}%`);
  frame.style.setProperty("--image-y", `${layout.y}%`);
  frame.style.setProperty("--image-w", `${layout.width}%`);
}

function readTextBlockLayout(element: HTMLElement, slideRect: DOMRect, storedLayout?: TextBlockLayout): TextBlockLayout {
  if (isFreeTextLayout(storedLayout)) return storedLayout;
  const rect = getTextBlockRect(element);
  const existingStyle = (storedLayout as TextBlockLayout | undefined)?.style;
  return normalizeTextBlockLayout({
    x: ((rect.left + rect.width / 2 - slideRect.left) / slideRect.width) * 100,
    y: ((rect.top + rect.height / 2 - slideRect.top) / slideRect.height) * 100,
    width: (rect.width / slideRect.width) * 100,
    style: existingStyle ?? readRenderedTextStyle(element)
  });
}

function readRenderedTextStyle(element: HTMLElement): TextBlockStyle | undefined {
  const sample = element.firstElementChild instanceof HTMLElement ? element.firstElementChild : element;
  const computed = window.getComputedStyle(sample);
  const fontSize = Number.parseFloat(computed.fontSize);
  const color = normalizeCssColor(computed.color);
  return cleanTextStyle({
    ...(Number.isFinite(fontSize) ? { fontSize } : {}),
    ...(color ? { color } : {})
  });
}

function getTextBlockRect(element: HTMLElement): DOMRect {
  if (element.classList.contains("slide-text-block--content")) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
  }
  const measuredElements = [...element.querySelectorAll(":scope :is(h1, h2, h3, p, ul, ol, pre, blockquote, table)")];
  const childRects = measuredElements
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
  if (childRects.length === 0) return element.getBoundingClientRect();
  const left = Math.min(...childRects.map((rect) => rect.left));
  const top = Math.min(...childRects.map((rect) => rect.top));
  const right = Math.max(...childRects.map((rect) => rect.right));
  const bottom = Math.max(...childRects.map((rect) => rect.bottom));
  return DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top });
}

function applyTextBlockLayout(element: HTMLElement, layout: TextBlockLayout) {
  element.dataset.textLayout = "free";
  layout.mode = "free";
  element.style.setProperty("--text-x", `${layout.x}%`);
  element.style.setProperty("--text-y", `${layout.y}%`);
  if (layout.width !== undefined) {
    element.style.setProperty("--text-w", `${layout.width}%`);
  }
  applyTextStyleProperties(element, layout.style);
}

function alignImageLayouts(layouts: Record<string, ImageLayout>, direction: AlignmentDirection): Record<string, ImageLayout> {
  const entries = Object.entries(layouts);
  if (entries.length < 2) return {};
  const bounds = layoutGroupBounds(
    entries.map(([, layout]) => ({
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.width * 0.5625
    }))
  );
  return Object.fromEntries(
    entries.map(([assetId, layout]) => {
      const height = layout.width * 0.5625;
      return [
        assetId,
        normalizeImageLayout({
          ...layout,
          x: alignedCenter(layout.x, layout.width, bounds, direction, "x"),
          y: alignedCenter(layout.y, height, bounds, direction, "y")
        })
      ];
    })
  );
}

function alignTextBlockLayouts(layouts: Record<string, TextBlockLayout>, direction: AlignmentDirection): Record<string, TextBlockLayout> {
  const entries = Object.entries(layouts);
  if (entries.length < 2) return {};
  const bounds = layoutGroupBounds(
    entries.map(([, layout]) => ({
      x: layout.x,
      y: layout.y,
      width: layout.width ?? 24,
      height: textLayoutHeight
    }))
  );
  return Object.fromEntries(
    entries.map(([block, layout]) => [
      block,
      normalizeTextBlockLayout({
        ...layout,
        x: alignedCenter(layout.x, layout.width ?? 24, bounds, direction, "x"),
        y: alignedCenter(layout.y, textLayoutHeight, bounds, direction, "y")
      })
    ])
  );
}

const textLayoutHeight = 8;

function layoutGroupBounds(layouts: Array<{ x: number; y: number; width: number; height: number }>) {
  const left = Math.min(...layouts.map((layout) => layout.x - layout.width / 2));
  const right = Math.max(...layouts.map((layout) => layout.x + layout.width / 2));
  const top = Math.min(...layouts.map((layout) => layout.y - layout.height / 2));
  const bottom = Math.max(...layouts.map((layout) => layout.y + layout.height / 2));
  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2
  };
}

function alignedCenter(
  currentCenter: number,
  size: number,
  bounds: ReturnType<typeof layoutGroupBounds>,
  direction: AlignmentDirection,
  axis: "x" | "y"
) {
  if (axis === "x") {
    if (direction === "left") return bounds.left + size / 2;
    if (direction === "center-horizontal") return bounds.centerX;
    if (direction === "right") return bounds.right - size / 2;
  }
  if (axis === "y") {
    if (direction === "top") return bounds.top + size / 2;
    if (direction === "center-vertical") return bounds.centerY;
    if (direction === "bottom") return bounds.bottom - size / 2;
  }
  return currentCenter;
}

function textBlockStyle(layout?: TextBlockLayout, isEditable = false): React.CSSProperties | undefined {
  if (!layout) return undefined;
  return {
    "--text-x": `${layout.x}%`,
    "--text-y": `${layout.y}%`,
    ...(layout.width === undefined ? {} : { "--text-w": `${layout.width}%` }),
    ...textStyleProperties(layout.style),
    ...(isEditable ? { pointerEvents: "none" } : {})
  } as React.CSSProperties;
}

function textStyleOnlyBlockStyle(layout?: TextBlockLayout): React.CSSProperties | undefined {
  return textStyleProperties(layout?.style) as React.CSSProperties;
}

function applyTextStyleProperties(element: HTMLElement, style: TextBlockStyle | undefined) {
  const properties = textStyleProperties(style);
  Object.entries(properties).forEach(([property, value]) => {
    element.style.setProperty(property, String(value));
  });
  if (style) {
    element.dataset.textStyle = "custom";
  }
}

function textStyleProperties(style: TextBlockStyle | undefined): Record<string, string> {
  if (!style) return {};
  return {
    ...(style.fontSize === undefined ? {} : { "--text-font-size": `${style.fontSize}px` }),
    ...(style.fontFamily === undefined ? {} : { "--text-font-family": style.fontFamily }),
    ...(style.color === undefined ? {} : { "--text-color": style.color }),
    ...(style.bold === undefined ? {} : { "--text-font-weight": style.bold ? "800" : "400" }),
    ...(style.lineHeight === undefined ? {} : { "--text-line-height": String(style.lineHeight) }),
    ...(style.lineHeight === undefined ? {} : { "--text-list-gap": `${Math.max(style.lineHeight * 8, 4)}px` }),
    ...(style.letterSpacing === undefined ? {} : { "--text-letter-spacing": `${style.letterSpacing}px` })
  };
}

function normalizeCssColor(color: string): string | undefined {
  const trimmed = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!rgb) return undefined;
  return `#${rgb
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function cleanTextStyle(style: TextBlockStyle): TextBlockStyle | undefined {
  const nextStyle: TextBlockStyle = {};
  if (style.fontSize !== undefined) nextStyle.fontSize = style.fontSize;
  if (style.fontFamily) nextStyle.fontFamily = style.fontFamily;
  if (style.color) nextStyle.color = style.color;
  if (style.bold !== undefined) nextStyle.bold = style.bold;
  if (style.lineHeight !== undefined) nextStyle.lineHeight = style.lineHeight;
  if (style.letterSpacing !== undefined) nextStyle.letterSpacing = style.letterSpacing;
  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function pruneUnusedAssets(markdown: string, assets: DeckAsset[], preservedAssetIds: Set<string> = new Set()) {
  return assets.filter((asset) => preservedAssetIds.has(asset.id) || markdown.includes(`asset:${asset.id}`));
}

function getUnusedAssetIds(markdown: string, assets: DeckAsset[], preservedAssetIds: Set<string> = new Set()) {
  return assets.filter((asset) => !preservedAssetIds.has(asset.id) && !markdown.includes(`asset:${asset.id}`)).map((asset) => asset.id);
}

function pruneUnusedImageLayouts(imageLayouts: Record<string, ImageLayout>, markdown: string) {
  return Object.fromEntries(Object.entries(imageLayouts).filter(([assetId]) => markdown.includes(`asset:${assetId}`)));
}

function pruneSlideCompositions(slideCompositions: SlideCompositionMap, slides: Slide[]) {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(Object.entries(slideCompositions).filter(([slideId]) => slideIds.has(slideId)));
}

function sanitizeGeneratedCompositions(slideCompositions: SlideCompositionMap, slides: Slide[]) {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(
    Object.entries(slideCompositions).filter(
      (entry): entry is [string, SlideComposition] => slideIds.has(entry[0]) && isSlideComposition(entry[1])
    )
  );
}

function sanitizeGeneratedTextFlows(slideTextFlows: Record<string, unknown>, slides: Slide[]) {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(
    Object.entries(slideTextFlows).filter(
      (entry): entry is [string, SlideTextFlowMode] => slideIds.has(entry[0]) && isSlideTextFlowMode(entry[1])
    )
  );
}

function sanitizeGeneratedMetadata(metadata: Record<string, unknown>, slides: Slide[]): SlideMetadataMap {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(
    Object.entries(metadata)
      .filter((entry): entry is [string, string] => slideIds.has(entry[0]) && typeof entry[1] === "string")
      .map(([slideId, value]) => [slideId, value.slice(0, 5000)])
  );
}

function pruneTextLayouts(textLayouts: Record<string, SlideTextLayout>, slides: Slide[]) {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(Object.entries(textLayouts).filter(([slideId]) => slideIds.has(slideId)));
}

function pruneSlideTextFlows(slideTextFlows: Record<string, SlideTextFlowMode>, slides: Slide[]) {
  const slideIds = new Set(slides.map((slide) => slide.id));
  return Object.fromEntries(Object.entries(slideTextFlows).filter(([slideId]) => slideIds.has(slideId)));
}

function isSlideTextFlowMode(value: unknown): value is SlideTextFlowMode {
  return value === "auto" || value === "one" || value === "two" || value === "three" || value === "grid";
}

function getTextLayoutForBlock(textLayout: SlideTextLayout | undefined, block: string): TextBlockLayout | undefined {
  if (!textLayout) return undefined;
  if (block === "title" || block === "body") return textLayout[block];
  return textLayout.blocks?.[block];
}

function isFreeTextLayout(layout: TextBlockLayout | undefined): layout is TextBlockLayout {
  return layout?.mode === "free";
}

function setTextLayoutForBlock(textLayout: SlideTextLayout | undefined, block: string, layout: TextBlockLayout): SlideTextLayout {
  const nextLayout: SlideTextLayout = { ...(textLayout ?? {}) };
  if (block === "title" || block === "body") {
    nextLayout[block] = layout;
    return nextLayout;
  }
  nextLayout.blocks = { ...(textLayout?.blocks ?? {}), [block]: layout };
  return nextLayout;
}

function duplicateMarkdownSlide(markdown: string, slideIndex: number) {
  const slides = splitMarkdownSlides(markdown);
  const safeSlideIndex = Math.max(0, Math.min(slideIndex, slides.length - 1));
  slides.splice(safeSlideIndex + 1, 0, slides[safeSlideIndex]);
  return slides.join("\n\n---\n\n");
}

function splitMarkdownSlides(markdown: string) {
  const normalized = markdown.trim();
  if (!normalized) return ["# AI Slides\n\nStart writing your story."];
  const slides = normalized
    .split(/\n\s*---\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return slides.length > 0 ? slides : [normalized];
}

function remapDuplicatedSlideValues<T>(values: Record<string, T>, oldSlides: Slide[], nextSlides: Slide[], duplicatedSlideIndex: number) {
  const nextValues: Record<string, T> = {};
  oldSlides.forEach((slide, index) => {
    const nextSlide = nextSlides[index > duplicatedSlideIndex ? index + 1 : index];
    if (nextSlide && values[slide.id] !== undefined) {
      nextValues[nextSlide.id] = cloneSlideValue(values[slide.id]);
    }
  });

  const duplicatedSlide = oldSlides[duplicatedSlideIndex];
  const insertedSlide = nextSlides[duplicatedSlideIndex + 1];
  if (duplicatedSlide && insertedSlide && values[duplicatedSlide.id] !== undefined) {
    nextValues[insertedSlide.id] = cloneSlideValue(values[duplicatedSlide.id]);
  }

  return nextValues;
}

function cloneSlideValue<T>(value: T): T {
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  return value;
}

function getPreservedAssetIds(draft: { brandLogo?: { assetId: string } }) {
  return new Set(draft.brandLogo ? [draft.brandLogo.assetId] : []);
}

function themeStyle(css: string): React.CSSProperties {
  return css
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<React.CSSProperties>((style, line) => {
      const [key, ...value] = line.split(":");
      if (key?.startsWith("--")) {
        return { ...style, [key.trim()]: value.join(":").trim() };
      }
      return style;
    }, {});
}

function getStatusClassName(status: string) {
  const normalizedStatus = status.toLowerCase();
  const classNames = ["status"];

  if (status.includes("正在优化") || status.includes("正在设计") || status.includes("正在把大纲")) {
    classNames.push("status--ai", "status--busy");
  } else if (status.includes("已优化") || status.includes("已生成") || status.includes("AI 美化完成") || status.includes("当前页面已经是推荐排版")) {
    classNames.push("status--ai", "status--success");
  }

  if (
    status.includes("DeepSeek") ||
    status.includes("还没有配置") ||
    status.includes("失败") ||
    normalizedStatus.includes("failed") ||
    normalizedStatus.includes("could not")
  ) {
    classNames.push("status--error");
  }

  return classNames.join(" ");
}

function clampLayoutValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function cssEscape(value: string) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function defaultInsertedImageLayout(index: number, total: number): ImageLayout {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const columns = Math.min(total, 3);
  const rows = Math.ceil(total / 3);
  return normalizeImageLayout({
    x: 50 + (column - (columns - 1) / 2) * 16,
    y: 50 + (row - (rows - 1) / 2) * 14,
    width: total === 1 ? 42 : 30
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "deck"
  );
}

function documentCreateAnchor() {
  return document.createElement("a");
}

function formatStorageSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

function formatElapsedTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
