import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProjectExport,
  createDocument,
  createDocumentWithDraft,
  defaultDraft,
  importProjectExport,
  loadDocumentLibrary,
  loadDraft,
  mergeHydratedAssets,
  saveActiveDocument,
  saveDraft,
  setActiveDocument
} from "./storage";

describe("draft storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads a default draft and persists user edits", () => {
    expect(loadDraft().markdown).toContain("# AI Slides");

    expect(saveDraft({
      markdown: "# Saved",
      themeId: "teaching-whiteboard",
      assets: [],
      imageLayouts: {
        img_class: { x: 72, y: 50, width: 42 }
      },
      slideCompositions: {
        "slide-2": "right-heavy"
      },
      slideTextFlows: {
        "slide-2": "two"
      },
      speakerNotes: {},
      slideIntents: {},
      slideRevealPlans: {},
      textLayouts: {
        "slide-2": {
          title: {
            x: 32,
            y: 28,
            mode: "free",
            width: 46,
            style: { fontSize: 68, fontFamily: "serif", color: "#e23d28", bold: true, lineHeight: 1.2, letterSpacing: 1.5 }
          },
          body: { x: 54, y: 62, width: 32 }
        }
      },
      brandLogo: {
        assetId: "logo_asset",
        position: "top-right"
      }
    })).toBe(true);

    expect(loadDraft()).toEqual({
      markdown: "# Saved",
      themeId: "teaching-whiteboard",
      assets: [],
      imageLayouts: {
        img_class: { x: 72, y: 50, width: 42 }
      },
      slideCompositions: {
        "slide-2": "right-heavy"
      },
      slideTextFlows: {
        "slide-2": "two"
      },
      speakerNotes: {},
      slideIntents: {},
      slideRevealPlans: {},
      textLayouts: {
        "slide-2": {
          title: {
            x: 32,
            y: 28,
            mode: "free",
            width: 46,
            style: { fontSize: 68, fontFamily: "serif", color: "#e23d28", bold: true, lineHeight: 1.2, letterSpacing: 1.5 }
          },
          body: { x: 54, y: 62, mode: "free", width: 32 }
        }
      },
      brandLogo: {
        assetId: "logo_asset",
        position: "top-right"
      }
    });
  });

  it("persists image drafts without storing data URLs in localStorage", () => {
    const saved = saveDraft({
      markdown: "## Image\n\n![Image](asset:img_saved)",
      themeId: "business-report",
      assets: [
        {
          id: "img_saved",
          name: "saved.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ],
      imageLayouts: {
        img_saved: { x: 50, y: 50, width: 42 }
      },
      slideCompositions: {},
      slideTextFlows: {},
      textLayouts: {}
    });

    const raw = localStorage.getItem("ai-ppt:draft") ?? "";

    expect(saved).toBe(true);
    expect(raw).not.toContain("data:image");
    expect(JSON.parse(raw).assets[0]).toEqual({
      id: "img_saved",
      name: "saved.png",
      mimeType: "image/png",
      sizeBytes: 100,
      createdAt: 1
    });
    expect(loadDraft().assets[0]).toEqual({
      id: "img_saved",
      name: "saved.png",
      mimeType: "image/png",
      dataUrl: "",
      sizeBytes: 100,
      createdAt: 1
    });
  });

  it("migrates older drafts that do not have an assets array", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Old",
        themeId: "business-report"
      })
    );

    expect(loadDraft()).toEqual({
      markdown: "# Old",
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
    });
  });

  it("drops invalid brand logo data from stored drafts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Bad logo",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        brandLogo: {
          assetId: "logo_asset",
          position: "bottom-left"
        }
      })
    );

    expect(loadDraft().brandLogo).toBeUndefined();
  });

  it("drops invalid slide composition data from stored drafts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Bad composition",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {
          "slide-1": "right-heavy",
          "slide-2": "not-real"
        }
      })
    );

    expect(loadDraft().slideCompositions).toEqual({
      "slide-1": "right-heavy"
    });
  });

  it("drops invalid image layout data from stored drafts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Bad layout",
        themeId: "business-report",
        assets: [],
        imageLayouts: {
          img_bad: { x: "left", y: 50, width: 40 }
        }
      })
    );

    expect(loadDraft().imageLayouts).toEqual({});
  });

  it("drops invalid text layout data from stored drafts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Bad text layout",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {
          "slide-1": {
            title: { x: 30, y: 20 },
            body: { x: "left", y: 50 }
          },
          "slide-2": {
            title: { x: Number.NaN, y: 12 }
          }
        }
      })
    );

    expect(loadDraft().textLayouts).toEqual({
      "slide-1": {
        title: { x: 30, y: 20, mode: "free" }
      }
    });
  });

  it("keeps valid free text widths and remains compatible with older text layouts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Text width",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {
          "slide-1": {
            title: { x: 30, y: 20, width: 52 },
            body: { x: 54, y: 60, style: { fontSize: 28, color: "#67d3b0" } }
          },
          "slide-2": {
            title: { x: 20, y: 24, width: "wide" },
            body: { x: 20, y: 24, style: { color: "red" } }
          }
        }
      })
    );

    expect(loadDraft().textLayouts).toEqual({
      "slide-1": {
        title: { x: 30, y: 20, mode: "free", width: 52 },
        body: { x: 54, y: 60, mode: "free", style: { fontSize: 28, color: "#67d3b0" } }
      }
    });
  });

  it("keeps valid text flow modes and independent body block layouts", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Text blocks",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {
          "slide-1": "three",
          "slide-2": "bad"
        },
        textLayouts: {
          "slide-1": {
            blocks: {
              "block-1": { x: 40, y: 50, width: 28, style: { lineHeight: 1.5 } },
              "block-2": { x: "bad", y: 50 }
            }
          }
        }
      })
    );

    expect(loadDraft().slideTextFlows).toEqual({
      "slide-1": "three"
    });
    expect(loadDraft().textLayouts).toEqual({
      "slide-1": {
        blocks: {
          "block-1": { x: 40, y: 50, width: 28, style: { lineHeight: 1.5 } }
        }
      }
    });
  });

  it("migrates inline data-image Markdown into short asset references", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "## 图片\n\n![课堂图](data:image/png;base64,abc123)",
        themeId: "business-report"
      })
    );

    const draft = loadDraft();

    expect(draft.markdown).toContain("![课堂图](asset:");
    expect(draft.markdown).not.toContain("data:image/png;base64,abc123");
    expect(draft.assets).toHaveLength(1);
    expect(draft.assets[0]).toMatchObject({
      name: "课堂图.png",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,abc123"
    });
  });

  it("migrates split inline data-image Markdown into short asset references", () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "## 图片\n\n![课堂图]\n(data:image/png;base64,abc123)",
        themeId: "business-report"
      })
    );

    const draft = loadDraft();

    expect(draft.markdown).toContain("![课堂图](asset:");
    expect(draft.markdown).not.toContain("(data:image/png;base64,abc123)");
    expect(draft.assets).toHaveLength(1);
  });

  it("falls back to defaults for invalid stored data", () => {
    localStorage.setItem("ai-ppt:draft", "{bad");

    expect(loadDraft()).toEqual(defaultDraft);
  });

  it("reports storage write failures instead of throwing", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });

    expect(() => saveDraft(defaultDraft)).not.toThrow();
    expect(saveDraft(defaultDraft)).toBe(false);

    setItem.mockRestore();
  });

  it("hydrates referenced assets without overwriting current draft fields", () => {
    const merged = mergeHydratedAssets(
      {
        markdown: "## 图片\n\n![图片](asset:img_saved)",
        themeId: "editorial-magazine",
        assets: [
          {
            id: "img_saved",
            name: "saved.png",
            mimeType: "image/png",
            dataUrl: "",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {
          img_saved: { x: 70, y: 52, width: 48 }
        },
        slideCompositions: {
          "slide-1": "split-panel"
        },
        slideTextFlows: {},
        textLayouts: {
          "slide-1": { title: { x: 36, y: 32 } }
        }
      },
      {
        markdown: "## Old",
        themeId: "business-report",
        assets: [
          {
            id: "img_saved",
            name: "saved.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,abc123",
            sizeBytes: 100,
            createdAt: 1
          },
          {
            id: "img_unused",
            name: "unused.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,unused",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {}
      }
    );

    expect(merged.markdown).toContain("asset:img_saved");
    expect(merged.themeId).toBe("editorial-magazine");
    expect(merged.imageLayouts.img_saved).toEqual({ x: 70, y: 52, width: 48 });
    expect(merged.slideCompositions).toEqual({ "slide-1": "split-panel" });
    expect(merged.textLayouts).toEqual({ "slide-1": { title: { x: 36, y: 32 } } });
    expect(merged.assets).toEqual([
      {
        id: "img_saved",
        name: "saved.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,abc123",
        sizeBytes: 100,
        createdAt: 1
      }
    ]);
  });

  it("restores referenced assets that are missing from current memory", () => {
    const merged = mergeHydratedAssets(
      {
        markdown: "## 图片\n\n![图片](asset:img_restored)",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {}
      },
      {
        markdown: "## 图片\n\n![图片](asset:img_restored)",
        themeId: "business-report",
        assets: [
          {
            id: "img_restored",
            name: "restored.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,restored",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {}
      }
    );

    expect(merged.assets).toHaveLength(1);
    expect(merged.assets[0].id).toBe("img_restored");
    expect(merged.assets[0].dataUrl).toBe("data:image/png;base64,restored");
  });

  it("migrates the legacy single draft into a local document library", () => {
    saveDraft({
      ...defaultDraft,
      markdown: "# Legacy deck",
      themeId: "teaching-whiteboard"
    });

    const library = loadDocumentLibrary();

    expect(library.documents).toHaveLength(1);
    expect(library.documents[0].title).toBe("Legacy deck");
    expect(library.documents[0].draft.markdown).toBe("# Legacy deck");
    expect(library.activeDocumentId).toBe(library.documents[0].id);
    expect(loadDraft().markdown).toBe("# Legacy deck");
  });

  it("creates, saves, and opens multiple local documents", () => {
    const firstLibrary = loadDocumentLibrary();
    const firstId = firstLibrary.activeDocumentId;
    const second = createDocument("第二份课件");

    expect(loadDocumentLibrary().activeDocumentId).toBe(second.id);
    expect(loadDraft().markdown).toContain("# 第二份课件");

    expect(saveActiveDocument({ ...defaultDraft, markdown: "# Second saved" })).toBe(true);
    setActiveDocument(firstId);
    expect(loadDraft().markdown).toContain("# AI Slides");

    setActiveDocument(second.id);
    expect(loadDraft().markdown).toBe("# Second saved");
    expect(loadDocumentLibrary().documents.map((document) => document.title)).toEqual(["AI Slides", "Second saved"]);
  });

  it("creates a local document from a generated draft and makes it active", () => {
    const generated = createDocumentWithDraft("AI 生成课件", {
      ...defaultDraft,
      markdown: "# AI 生成课件",
      themeId: "teaching-whiteboard",
      slideCompositions: { "slide-1": "cover-stage" }
    });

    const library = loadDocumentLibrary();

    expect(library.activeDocumentId).toBe(generated.id);
    expect(loadDraft().markdown).toBe("# AI 生成课件");
    expect(loadDraft().slideCompositions).toEqual({ "slide-1": "cover-stage" });
    expect(library.documents.map((document) => document.title)).toEqual(["AI Slides", "AI 生成课件"]);
  });

  it("persists generated speaker notes, intents, and reveal plans", () => {
    expect(saveDraft({
      ...defaultDraft,
      markdown: "# Generated",
      speakerNotes: { "slide-1": "这一页先建立共识。" },
      slideIntents: { "slide-1": "说明为什么要听这一课。" },
      slideRevealPlans: { "slide-1": "标题先出，再逐条出现。" }
    })).toBe(true);

    expect(loadDraft()).toMatchObject({
      speakerNotes: { "slide-1": "这一页先建立共识。" },
      slideIntents: { "slide-1": "说明为什么要听这一课。" },
      slideRevealPlans: { "slide-1": "标题先出，再逐条出现。" }
    });
  });

  it("exports and imports an editable project document with assets", () => {
    const exported = buildProjectExport(
      {
        ...defaultDraft,
        markdown: "# Backup\n\n![图](asset:img_backup)",
        assets: [
          {
            id: "img_backup",
            name: "backup.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,backup",
            sizeBytes: 128,
            createdAt: 2
          }
        ],
        imageLayouts: {
          img_backup: { x: 50, y: 52, width: 40 }
        }
      },
      "备份课件"
    );

    const imported = importProjectExport(exported);

    expect(imported.title).toBe("备份课件");
    expect(imported.draft.markdown).toContain("asset:img_backup");
    expect(imported.draft.assets[0].dataUrl).toBe("data:image/png;base64,backup");
    expect(loadDocumentLibrary().activeDocumentId).toBe(imported.id);
  });
});
