import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import "./styles.css";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("App image insertion controls", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("opens the image panel and triggers the hidden file input from the select button", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-image-panel']").click();
    });

    expect(getElement("[role='dialog'][aria-label='Insert image']")).toBeTruthy();

    const fileInput = getElement<HTMLInputElement>("[data-testid='image-file-input']");
    const fileClick = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='select-image-button']").click();
    });

    expect(fileClick).toHaveBeenCalledTimes(1);
  });

  it("creates and opens local PPT documents while auto-saving the current one", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-document-library']").click();
    });

    expect(getElement("[role='dialog'][aria-label='Document library']")).toBeTruthy();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='create-document']").click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toContain("# 未命名课件");

    await act(async () => {
      const textarea = getElement<HTMLTextAreaElement>("[name='markdown-source']");
      setNativeTextareaValue(textarea, "# 第二份\n\n新内容");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-document-library']").click();
    });

    const firstDocumentButton = [...document.querySelectorAll<HTMLButtonElement>("[data-testid^='open-document-']")].find((button) =>
      button.textContent?.includes("AI Slides")
    );
    expect(firstDocumentButton).toBeTruthy();

    await act(async () => {
      firstDocumentButton?.click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toContain("# AI Slides");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-document-library']").click();
    });
    const secondDocumentButton = [...document.querySelectorAll<HTMLButtonElement>("[data-testid^='open-document-']")].find((button) =>
      button.textContent?.includes("第二份")
    );
    expect(secondDocumentButton).toBeTruthy();

    await act(async () => {
      secondDocumentButton?.click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toContain("# 第二份");
  });

  it("requests fullscreen when presentation mode starts", async () => {
    const root = createRoot(container);
    const fullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: fullscreen
    });

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='present-deck']").click();
    });

    expect(fullscreen).toHaveBeenCalledTimes(1);
    expect(getElement("[role='dialog'][aria-label='Presentation preview']")).toBeTruthy();
  });

  it("opens a separate audience window and shows presenter notes in speaker mode", async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 第一页

开场段落

---

## 第二页

- 下一步`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {},
        speakerNotes: { "slide-1": "第一页讲稿", "slide-2": "第二页讲稿" },
        slideIntents: { "slide-1": "建立动机", "slide-2": "说明路径" },
        slideRevealPlans: { "slide-1": "标题先出", "slide-2": "要点逐条出现" }
      })
    );
    const root = createRoot(container);
    const openedWindow = { closed: false } as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(openedWindow);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='speaker-mode']").click();
    });

    expect(open).toHaveBeenCalledWith(expect.stringContaining("?presenter=audience"), "ai-ppt-audience");
    expect(getElement("[data-testid='presenter-console']")).toBeTruthy();
    const currentSlideCanvas = getElement("[data-testid='presenter-console'] .presenter-console__current .slide-canvas");
    expect(document.querySelector("[role='dialog'][aria-label='Presentation preview']")).toBeNull();
    expect(getElement("[data-testid='presenter-timer']").textContent).toContain("LIVE TIMER");
    expect(getElement("[data-testid='presenter-speaker-note']").textContent).toContain("第一页讲稿");
    expect(getElement("[data-testid='presenter-slide-intent']").textContent).toContain("建立动机");
    expect(getElement("[data-testid='presenter-reveal-plan']").textContent).toContain("标题先出");
    expect(getElement("[data-testid='presenter-next-slide']").textContent).toContain("Next");
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(getElement("[data-testid='presenter-timer']").textContent).toContain("00:03");
    expect(getElement("[data-testid='presenter-console'] .presenter-console__current .slide-canvas")).toBe(currentSlideCanvas);

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='presenter-next-step']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='presenter-next-step']").click();
    });

    expect(getElement("[data-testid='presenter-speaker-note']").textContent).toContain("第二页讲稿");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='exit-speaker-mode']").click();
    });

    expect(document.querySelector("[data-testid='presenter-console']")).toBeNull();
    vi.useRealTimers();
  });

  it("keeps the generated document unchanged while speaker mode is open and closed", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# 原课件",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {},
        speakerNotes: {},
        slideIntents: {},
        slideRevealPlans: {}
      })
    );
    const root = createRoot(container);
    vi.spyOn(window, "open").mockReturnValue({ closed: false } as Window);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-document-library']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='create-document']").click();
    });
    await act(async () => {
      const textarea = getElement<HTMLTextAreaElement>("[name='markdown-source']");
      setNativeTextareaValue(textarea, "# AI 生成课件\n\n新内容");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='speaker-mode']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='exit-speaker-mode']").click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toContain("# AI 生成课件");
  });

  it("renders audience mode as a clean presentation page from broadcast state", async () => {
    window.history.replaceState(null, "", "/?presenter=audience");
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# 不应该被观众窗口加载",
        themeId: "tech-night",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {},
        speakerNotes: {},
        slideIntents: {},
        slideRevealPlans: {}
      })
    );
    localStorage.setItem(
      "ai-ppt:presentation-state",
      JSON.stringify({
        type: "presentation-state",
        activeSlide: 1,
        revealStep: 0,
        draft: {
          markdown: `# 第一页

开场

---

## 第二页

观众看到这一页`,
          themeId: "business-report",
          assets: [],
          imageLayouts: {},
          slideCompositions: {},
          slideTextFlows: {},
          textLayouts: {},
          speakerNotes: {},
          slideIntents: {},
          slideRevealPlans: {}
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(getElement("[data-testid='audience-presentation']")).toBeTruthy();
    expect(getElement("[data-testid='audience-presentation']").textContent).toContain("观众看到这一页");
    expect(getElement("[data-testid='audience-presentation']").textContent).not.toContain("不应该被观众窗口加载");
    expect(document.querySelector("[name='markdown-source']")).toBeNull();
    expect(document.querySelector("[data-testid='speaker-notes-panel']")).toBeNull();
    expect(localStorage.getItem("ai-ppt:draft")).toContain("不应该被观众窗口加载");
  });

  it("changes only the selected slide composition from the preview controls", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='composition-right-heavy']").click();
    });

    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--right-heavy");

    await act(async () => {
      getElement<HTMLButtonElement>("[aria-label='Next slide']").click();
    });

    expect(getElement(".preview-pane .slide-canvas").className).not.toContain("slide-composition--right-heavy");
  });

  it("duplicates the selected thumbnail slide after the current slide", async () => {
    const markdown = `# 第一页

开场

---

## 第二页

- A
- B

---

## 第三页

收尾`;
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: { "slide-2": "right-heavy", "slide-3": "poster-bottom" },
        textLayouts: {
          "slide-2": { title: { x: 42, y: 28, width: 64 } },
          "slide-3": { body: { x: 55, y: 62, width: 48 } }
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[aria-label='Next slide']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='duplicate-slide']").click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toBe(`# 第一页

开场

---

## 第二页

- A
- B

---

## 第二页

- A
- B

---

## 第三页

收尾`);
    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--right-heavy");
    expect(getElement<HTMLElement>(".preview-pane .slide-text-block--title").style.getPropertyValue("--text-x")).toBe("42%");
    expect(getElement(".status").textContent).toContain("已复制本页");

    await act(async () => {
      getElement<HTMLButtonElement>("[aria-label='Next slide']").click();
    });

    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--poster-bottom");
    expect(getElement<HTMLElement>(".preview-pane .slide-text-block--body").style.getPropertyValue("--text-x")).toBe("55%");
  });

  it("places preview controls inside the preview header toolbar", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const toolbar = getElement("[data-testid='preview-toolbar']");
    const previewHeader = getElement(".pane-head--preview");

    expect(previewHeader.contains(toolbar)).toBe(true);
    expect(document.querySelector(".theme-strip")).toBeNull();
    expect(document.querySelector(".composition-strip")).toBeNull();
    expect(document.querySelector(".brand-logo-strip")).toBeNull();
  });

  it("keeps ordinary save status visually quiet", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const status = getElement(".status");
    expect(status.textContent).toContain("Draft auto-saved locally");
    expect(status.className).not.toContain("status--ai");
    expect(status.className).not.toContain("status--error");
  });

  it("renders new visual theme controls with previews and applies the selected theme", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const themeButton = getElement<HTMLButtonElement>("[data-testid='theme-executive-noir']");
    expect(themeButton.title).toContain("Black-gold");
    expect(themeButton.style.getPropertyValue("--slide-accent")).toBe("#c9a45d");
    expect(themeButton.style.getPropertyValue("--slide-bg-base")).toContain("radial-gradient");

    await act(async () => {
      themeButton.click();
    });

    expect(getElement(".status").textContent).toContain("Theme set to Executive Noir");
    expect(getElement<HTMLElement>(".app").style.getPropertyValue("--slide-accent")).toBe("#c9a45d");
    expect(getElement<HTMLElement>(".app").style.getPropertyValue("--slide-bg-wash")).toContain("linear-gradient");
  });

  it("collapses the topbar while keeping core actions available", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const app = getElement(".app");
    expect(app.className).not.toContain("app--topbar-collapsed");
    expect(getElement("[data-testid='toggle-topbar']").getAttribute("aria-label")).toBe("Collapse topbar");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='toggle-topbar']").click();
    });

    expect(app.className).toContain("app--topbar-collapsed");
    expect(getElement("[data-testid='toggle-topbar']").getAttribute("aria-label")).toBe("Expand topbar");
    expect(getElement("[data-testid='open-image-panel']")).toBeTruthy();
    expect(getElement("[data-testid='present-deck']")).toBeTruthy();
    expect(getElement("[data-testid='export-html']")).toBeTruthy();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='toggle-topbar']").click();
    });

    expect(app.className).not.toContain("app--topbar-collapsed");
  });

  it("opens AI actions and optimizes slide layouts without changing markdown or logo", async () => {
    const markdown = `# Branded Deck

Intro

---

## 第一页

- 要点一
- 要点二

---

## 第二页

- 要点三
- 要点四`;
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown,
        themeId: "business-report",
        assets: [
          {
            id: "logo_asset",
            name: "logo.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,logo123",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {},
        brandLogo: {
          assetId: "logo_asset",
          position: "top-left"
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-menu-button']").click();
    });

    expect(getElement("[data-testid='ai-optimize-copy']")).toBeTruthy();
    expect(getElement("[data-testid='ai-optimize-layout']")).toBeTruthy();
    expect(getElement("[data-testid='ai-beautify-deck']")).toBeTruthy();

    const beforeClassName = getElement(".preview-pane .slide-canvas").className;

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-optimize-layout']").click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toBe(markdown);
    expect(getElement(".preview-pane .slide-logo").className).toContain("slide-logo--top-left");
    expect(getElement(".status").textContent).toContain("已优化排版：调整了 2 / 3 页。");
    expect(getElement(".status").className).toContain("status--ai");
    expect(getElement(".status").className).toContain("status--success");
    expect(getElement(".preview-pane .slide-canvas").className).not.toBe(beforeClassName);
    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--split-panel");
  });

  it("beautifies the whole deck without changing markdown or manual text layouts", async () => {
    const markdown = `# Branded Deck

Intro

---

## 第一页

- 要点一
- 要点二
- 要点三
- 要点四

---

## 第二页

- 要点五
- 要点六
- 要点七
- 要点八
- 要点九
- 要点十`;
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown,
        themeId: "business-report",
        assets: [
          {
            id: "logo_asset",
            name: "logo.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,logo123",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {
          "slide-2": { body: { x: 52, y: 60, width: 40 } }
        },
        brandLogo: {
          assetId: "logo_asset",
          position: "top-left"
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-menu-button']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-beautify-deck']").click();
    });

    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toBe(markdown);
    expect(getElement(".preview-pane .slide-logo").className).toContain("slide-logo--top-left");
    expect(getElement(".status").textContent).toContain("AI 美化完成");
    expect(getElement(".status").textContent).toContain("优化分栏");
    expect(getElement(".status").className).toContain("status--ai");

    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--grid");
    expect(localStorage.getItem("ai-ppt:draft")).toContain('"slide-2":{"body":{"x":52,"y":60,"width":40}}');

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='undo-edit']").click();
    });

    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--auto");
  });

  it("checks and beautifies the current slide with undo support", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 当前挑战

- 课堂材料分散
- 学生注意力难持续
- 课后复盘缺少结构
- 教学成果难展示`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    function mockCrowdedSlideRects() {
      const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
      const title = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
      const body = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
      Object.defineProperty(canvas, "getBoundingClientRect", {
        configurable: true,
        value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 562.5 })
      });
      Object.defineProperty(title, "getBoundingClientRect", {
        configurable: true,
        value: () => DOMRect.fromRect({ x: -10, y: 80, width: 620, height: 220 })
      });
      Object.defineProperty(body, "getBoundingClientRect", {
        configurable: true,
        value: () => DOMRect.fromRect({ x: 120, y: 190, width: 520, height: 160 })
      });
    }
    mockCrowdedSlideRects();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='check-current-slide']").click();
    });

    expect(getElement(".status").textContent).toContain("发现");
    expect(getElement(".status").textContent).toContain("标题超出安全区");
    mockCrowdedSlideRects();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='beautify-current-slide']").click();
    });

    expect(getElement(".status").textContent).toContain("已美化本页");
    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--two");
    expect(getElement<HTMLElement>(".preview-pane .slide-text-block--title").style.getPropertyValue("--text-font-size")).toBe("56px");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='undo-edit']").click();
    });

    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--auto");
  });

  it("shows a friendly Chinese message when copy optimization fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "还没有配置 DeepSeek API Key，请先在 .env 里填写 DEEPSEEK_API_KEY。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-menu-button']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='ai-optimize-copy']").click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/optimize-markdown",
      expect.objectContaining({ method: "POST" })
    );
    expect(getElement(".status").textContent).toContain("还没有配置 DeepSeek API Key");
    expect(getElement(".status").className).toContain("status--error");
  });

  it("generates an editable outline and creates a new PPT document from it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/generate-outline") {
        return new Response(
          JSON.stringify({
            title: "AI PPT 使用课",
            slides: [
              { id: "slide-1", title: "开场", bullets: ["为什么需要课件工具"], purpose: "cover" },
              { id: "slide-2", title: "三步完成课件", bullets: ["输入主题", "确认大纲"], purpose: "method" }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url === "/api/generate-deck") {
        return new Response(
          JSON.stringify({
            markdown: "# 改过的开场\n\n为什么需要课件工具\n\n---\n\n## 三步完成课件\n\n- 输入主题\n- 确认大纲",
            themeId: "teaching-whiteboard",
            slideCompositions: { "slide-1": "cover-stage", "slide-2": "split-panel" },
            slideTextFlows: { "slide-2": "two" },
            speakerNotes: { "slide-1": "先讲为什么课件工具能省时间。", "slide-2": "这里强调先确认大纲再生成。" },
            slideIntents: { "slide-1": "建立学习动机", "slide-2": "说明操作路径" },
            revealPlan: { "slide-1": "标题先出，再出正文", "slide-2": "按要点逐条出现" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-generate-deck']").click();
    });

    expect(getElement("[role='dialog'][aria-label='AI deck generator']")).toBeTruthy();

    await act(async () => {
      const topic = getElement<HTMLInputElement>("[data-testid='generate-topic']");
      setNativeInputValue(topic, "AI PPT 使用课");
      topic.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='generate-outline']").click();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/generate-outline", expect.objectContaining({ method: "POST" }));
    expect(getElement<HTMLInputElement>("[data-testid='outline-title-1']").value).toBe("三步完成课件");

    await act(async () => {
      const title = getElement<HTMLInputElement>("[data-testid='outline-title-0']");
      setNativeInputValue(title, "改过的开场");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='generate-deck']").click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate-deck",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("改过的开场")
      })
    );
    expect(document.querySelector("[role='dialog'][aria-label='AI deck generator']")).toBeNull();
    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).toContain("# 改过的开场");
    expect(getElement(".status").textContent).toContain("已生成 2 页课件");
    expect(getElement(".status").className).toContain("status--success");
    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--cover-stage");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='toggle-speaker-notes']").click();
    });

    expect(getElement("[data-testid='slide-intent']").textContent).toContain("建立学习动机");
    expect(getElement("[data-testid='slide-reveal-plan']").textContent).toContain("标题先出");
    expect(getElement<HTMLTextAreaElement>("[data-testid='speaker-note-editor']").value).toContain("先讲为什么");

    await act(async () => {
      getElement<HTMLButtonElement>("[aria-label='Next slide']").click();
    });

    expect(getElement("[data-testid='slide-intent']").textContent).toContain("说明操作路径");
    expect(getElement(".preview-pane .slide-canvas").className).toContain("slide-composition--split-panel");

    await act(async () => {
      const note = getElement<HTMLTextAreaElement>("[data-testid='speaker-note-editor']");
      setNativeTextareaValue(note, "改过的第二页讲稿");
      note.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(getElement(".status").textContent).toContain("讲稿已保存");
    expect(getElement<HTMLTextAreaElement>("[data-testid='speaker-note-editor']").value).toBe("改过的第二页讲稿");
  });

  it("shows an animated waiting state while generating a PPT deck", async () => {
    vi.useFakeTimers();
    let resolveDeck: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/generate-outline") {
        return new Response(
          JSON.stringify({
            title: "慢速生成测试",
            slides: [{ id: "slide-1", title: "开场", bullets: ["等待反馈"], purpose: "cover" }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url === "/api/generate-deck") {
        return new Promise<Response>((resolve) => {
          resolveDeck = resolve;
        });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-generate-deck']").click();
    });
    await act(async () => {
      const topic = getElement<HTMLInputElement>("[data-testid='generate-topic']");
      setNativeInputValue(topic, "慢速生成测试");
      topic.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='generate-outline']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='generate-deck']").click();
    });

    expect(getElement("[data-testid='generating-status']").textContent).toContain("正在生成可编辑 PPT");
    expect(getElement<HTMLButtonElement>("[data-testid='generate-deck']").disabled).toBe(true);
    expect(getElement<HTMLButtonElement>("[aria-label='Close AI deck generator']").disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(getElement("[data-testid='generating-status']").textContent).toContain("已等待 5 秒");

    await act(async () => {
      resolveDeck?.(
        new Response(
          JSON.stringify({
            markdown: "# 开场\n\n等待反馈",
            themeId: "teaching-whiteboard",
            slideCompositions: {},
            speakerNotes: {},
            slideIntents: {},
            revealPlan: {}
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });

    expect(document.querySelector("[data-testid='generating-status']")).toBeNull();
    vi.useRealTimers();
  });

  it("shows a stored brand logo and changes its corner", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# Branded Deck",
        themeId: "business-report",
        assets: [
          {
            id: "logo_asset",
            name: "logo.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,logo123",
            sizeBytes: 100,
            createdAt: 1
          }
        ],
        imageLayouts: {},
        slideCompositions: {},
        brandLogo: {
          assetId: "logo_asset",
          position: "top-left"
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(getElement(".preview-pane .slide-logo").className).toContain("slide-logo--top-left");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='brand-logo-position-top-right']").click();
    });

    expect(getElement(".preview-pane .slide-logo").className).toContain("slide-logo--top-right");
  });

  it("uses a native file label for brand logo upload", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const fileInput = getElement<HTMLInputElement>("[data-testid='brand-logo-file-input']");
    const uploadControl = getElement<HTMLLabelElement>("[data-testid='select-brand-logo-button']");

    expect(uploadControl.tagName).toBe("LABEL");
    expect(uploadControl.contains(fileInput)).toBe(true);
    expect(fileInput.type).toBe("file");
  });

  it("adds the text animation class only in presentation mode", async () => {
    const root = createRoot(container);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(getElement(".preview-pane .slide-canvas").className).not.toContain("slide-canvas--presenting");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='present-deck']").click();
    });

    expect(getElement(".presentation .slide-canvas").className).toContain("slide-canvas--presenting");
  });

  it("wraps the editable slide in an auto-fit preview stage without scaling presentation mode", async () => {
    const root = createRoot(container);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });

    await act(async () => {
      root.render(<App />);
    });

    const stage = getElement<HTMLElement>("[data-testid='slide-preview-stage']");
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1067, height: 600 })
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    const scaleWrap = getElement<HTMLElement>("[data-testid='slide-preview-scale']");
    const editableCanvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    expect(stage.style.getPropertyValue("--preview-slide-width")).toBe("1600px");
    expect(stage.style.getPropertyValue("--preview-slide-height")).toBe("900px");
    expect(Number(stage.style.getPropertyValue("--preview-scale"))).toBeCloseTo(0.667, 2);
    expect(scaleWrap.contains(editableCanvas)).toBe(true);

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='present-deck']").click();
    });

    const presentationCanvas = getElement<HTMLElement>(".presentation .slide-canvas");
    expect(presentationCanvas.closest("[data-testid='slide-preview-scale']")).toBeNull();
  });

  it("reveals presentation content by block before moving to the next slide", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 第一页

开场段落

- 要点一
- 要点二

---

## 第二页

结束`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {}
      })
    );
    const root = createRoot(container);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='present-deck']").click();
    });

    expect(getElement(".presentation .slide-canvas").getAttribute("data-reveal-step")).toBe("0");
    expect(getElement(".presentation [data-reveal-index='0']").className).toContain("is-revealed");
    expect(getElement(".presentation [data-reveal-index='1']").className).toContain("is-hidden");
    expect(getElement(".presentation-footer").textContent).toContain("1 / 2");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(getElement(".presentation .slide-canvas").getAttribute("data-reveal-step")).toBe("1");
    expect(getElement(".presentation [data-reveal-index='1']").className).toContain("is-revealed");
    expect(getElement(".presentation-footer").textContent).toContain("1 / 2");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(getElement(".presentation-footer").textContent).toContain("2 / 2");
    expect(getElement(".presentation .slide-canvas").getAttribute("data-reveal-step")).toBe("0");
  });

  it("reveals images by Markdown order before moving to the next slide", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 第一页

开场

![第一张](asset:img_one)

补充

![第二张](asset:img_two)

---

## 第二页

结束`,
        themeId: "business-report",
        assets: [
          {
            id: "img_one",
            name: "one.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,one",
            sizeBytes: 100,
            createdAt: 1
          },
          {
            id: "img_two",
            name: "two.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,two",
            sizeBytes: 100,
            createdAt: 2
          }
        ],
        imageLayouts: {
          img_two: { x: 70, y: 50, width: 36 }
        },
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='present-deck']").click();
    });

    expect(getElement(".presentation .slide-canvas").getAttribute("data-reveal-count")).toBe("5");
    expect(getElement(".presentation [data-asset-id='img_one']").getAttribute("data-reveal-index")).toBe("2");
    expect(getElement(".presentation [data-asset-id='img_two']").getAttribute("data-reveal-index")).toBe("4");
    expect(getElement(".presentation [data-asset-id='img_one']").className).toContain("is-hidden");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(getElement(".presentation .slide-canvas").getAttribute("data-reveal-step")).toBe("2");
    expect(getElement(".presentation [data-asset-id='img_one']").className).toContain("is-revealed");
    expect(getElement(".presentation-footer").textContent).toContain("1 / 2");
  });

  it("moves ctrl-selected slide images together", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 图片页

![第一张](asset:img_one)

![第二张](asset:img_two)`,
        themeId: "business-report",
        assets: [
          {
            id: "img_one",
            name: "one.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,one",
            sizeBytes: 100,
            createdAt: 1
          },
          {
            id: "img_two",
            name: "two.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,two",
            sizeBytes: 100,
            createdAt: 2
          }
        ],
        imageLayouts: {
          img_one: { x: 40, y: 45, width: 30 },
          img_two: { x: 64, y: 48, width: 28 }
        },
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });

    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 400, clientY: 225, pointerId: 41, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 640, clientY: 240, pointerId: 42, ctrlKey: true })
      );
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dataset.imageSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").dataset.imageSelected).toBe("true");

    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 400, clientY: 225, pointerId: 43 })
      );
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 500, clientY: 275, pointerId: 43 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 500, clientY: 275, pointerId: 43 }));
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").style.getPropertyValue("--image-x")).toBe("50%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").style.getPropertyValue("--image-y")).toBe("55%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-x")).toBe("74%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-y")).toBe("58%");
  });

  it("aligns ctrl-selected slide images against the selected group bounds", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Image slide

![one](asset:img_one)
![two](asset:img_two)`,
        themeId: "business-report",
        assets: [
          {
            id: "img_one",
            name: "one.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,one",
            sizeBytes: 100,
            createdAt: 1
          },
          {
            id: "img_two",
            name: "two.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,two",
            sizeBytes: 100,
            createdAt: 2
          }
        ],
        imageLayouts: {
          img_one: { x: 40, y: 45, width: 30 },
          img_two: { x: 64, y: 48, width: 28 }
        },
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 400, clientY: 225, pointerId: 51, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 640, clientY: 240, pointerId: 52, ctrlKey: true })
      );
    });

    expect(getElement("[data-testid='selection-align-toolbar']")).toBeTruthy();
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='align-left']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").style.getPropertyValue("--image-x")).toBe("40%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-x")).toBe("39%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-y")).toBe("48%");
    expect(getElement(".status").textContent).toContain("已对齐 2 张图片");
  });

  it("undoes and redoes image alignment with keyboard shortcuts", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Image slide

![one](asset:img_one)
![two](asset:img_two)`,
        themeId: "business-report",
        assets: [
          {
            id: "img_one",
            name: "one.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,one",
            sizeBytes: 100,
            createdAt: 1
          },
          {
            id: "img_two",
            name: "two.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,two",
            sizeBytes: 100,
            createdAt: 2
          }
        ],
        imageLayouts: {
          img_one: { x: 40, y: 45, width: 30 },
          img_two: { x: 64, y: 48, width: 28 }
        },
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 400, clientY: 225, pointerId: 101, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 640, clientY: 240, pointerId: 102, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='align-left']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-x")).toBe("39%");

    await act(async () => {
      window.dispatchEvent(createKeyboardEvent("keydown", { key: "z", metaKey: true }));
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-x")).toBe("64%");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_one']").dataset.imageSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").dataset.imageSelected).toBe("true");

    await act(async () => {
      window.dispatchEvent(createKeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true }));
    });

    expect(getElement<HTMLElement>(".preview-pane [data-asset-id='img_two']").style.getPropertyValue("--image-x")).toBe("39%");
  });

  it("accepts multiple image selection but rejects more than nine files", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='open-image-panel']").click();
    });

    const input = getElement<HTMLInputElement>("[data-testid='image-file-input']");
    expect(input.multiple).toBe(true);
    Object.defineProperty(input, "files", {
      configurable: true,
      value: Array.from({ length: 10 }, (_, index) => new File(["x"], `image-${index}.png`, { type: "image/png" }))
    });

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(getElement(".image-panel-status").textContent).toContain("最多一次上传 9 张图片");
    expect(getElement<HTMLTextAreaElement>("[name='markdown-source']").value).not.toContain("image-0");
  });

  it("lets the selected slide title move independently from the body", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const title = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(title, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 100, width: 200, height: 50 })
    });

    await act(async () => {
      title.dispatchEvent(createPointerEvent("pointerdown", { clientX: 200, clientY: 125, pointerId: 9 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 300, clientY: 175, pointerId: 9 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 300, clientY: 175, pointerId: 9 }));
    });

    const titleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    const bodyBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--body");

    expect(titleBlock.dataset.textLayout).toBe("free");
    expect(getElement(".preview-pane .slide-text-layer").contains(titleBlock)).toBe(true);
    expect(titleBlock.style.getPropertyValue("--text-x")).toBe("30%");
    expect(titleBlock.style.getPropertyValue("--text-y")).toBe("35%");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("20%");
    expect(bodyBlock.dataset.textLayout).toBeUndefined();
    expect(getElement(".preview-pane .slide-content").contains(bodyBlock)).toBe(true);
    expect(getComputedStyle(titleBlock).pointerEvents).toBe("none");

    const movedBody = getElement<HTMLElement>(".preview-pane .slide-text-block--body p");
    Object.defineProperty(movedBody, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 120, y: 220, width: 300, height: 40 })
    });

    await act(async () => {
      movedBody.dispatchEvent(createPointerEvent("pointerdown", { clientX: 270, clientY: 240, pointerId: 10 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 220, clientY: 290, pointerId: 10 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 220, clientY: 290, pointerId: 10 }));
    });

    const movedBodyBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--body");
    expect(movedBodyBlock.dataset.textLayout).toBe("free");
    expect(movedBodyBlock.closest(".slide-text-layer")).toBeTruthy();
    expect(movedBodyBlock.style.getPropertyValue("--text-x")).toBe("22%");
    expect(movedBodyBlock.style.getPropertyValue("--text-y")).toBe("58%");
    expect(movedBodyBlock.style.getPropertyValue("--text-w")).toBe("30%");
  });

  it("lets the selected slide title resize its line length from a right-side handle", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# AI Slides\n\nStart writing your story.",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {
          "slide-1": { title: { x: 20, y: 25, mode: "free", width: 20 } }
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });

    const titleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    const bodyBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--body");
    const resizeHandle = getElement<HTMLElement>(".preview-pane .slide-text-block--title .text-resize-handle");

    expect(titleBlock.style.getPropertyValue("--text-x")).toBe("20%");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("20%");
    expect(resizeHandle.getAttribute("aria-label")).toBe("Resize text line length");

    await act(async () => {
      resizeHandle.dispatchEvent(createPointerEvent("pointerdown", { clientX: 300, clientY: 125, pointerId: 22 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 500, clientY: 125, pointerId: 22 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 500, clientY: 125, pointerId: 22 }));
    });

    expect(titleBlock.style.getPropertyValue("--text-x")).toBe("30%");
    expect(titleBlock.style.getPropertyValue("--text-y")).toBe("25%");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("40%");
    expect(bodyBlock.dataset.textLayout).toBeUndefined();
  });

  it("keeps the left edge stable when text resize reaches width limits", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: "# AI Slides\n\nStart writing your story.",
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {
          "slide-1": { title: { x: 50, y: 25, mode: "free", width: 90 } }
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });

    const titleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    const resizeHandle = getElement<HTMLElement>(".preview-pane .slide-text-block--title .text-resize-handle");
    expect(titleBlock.style.getPropertyValue("--text-x")).toBe("50%");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("90%");

    await act(async () => {
      resizeHandle.dispatchEvent(createPointerEvent("pointerdown", { clientX: 950, clientY: 125, pointerId: 32 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 1250, clientY: 125, pointerId: 32 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 1250, clientY: 125, pointerId: 32 }));
    });

    expect(titleBlock.style.getPropertyValue("--text-x")).toBe("55%");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("100%");
  });

  it("does not recalculate preview scale when selecting a text block", async () => {
    const root = createRoot(container);
    const resizeObserverInstances: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    const originalResizeObserver = globalThis.ResizeObserver;
    const resizeObserverMock = vi.fn().mockImplementation(() => {
      const instance = { observe: vi.fn(), disconnect: vi.fn() };
      resizeObserverInstances.push(instance);
      return instance;
    });
    globalThis.ResizeObserver = resizeObserverMock as unknown as typeof ResizeObserver;

    try {
      await act(async () => {
        root.render(<App />);
      });

      const stage = getElement<HTMLElement>("[data-testid='slide-preview-stage']");
      const title = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
      Object.defineProperty(stage, "getBoundingClientRect", {
        configurable: true,
        value: () => DOMRect.fromRect({ x: 0, y: 0, width: 960, height: 540 })
      });
      Object.defineProperty(title, "getBoundingClientRect", {
        configurable: true,
        value: () => DOMRect.fromRect({ x: 100, y: 100, width: 200, height: 50 })
      });
      const observeCallsBeforeSelect = resizeObserverInstances.reduce((count, instance) => count + instance.observe.mock.calls.length, 0);

      await act(async () => {
        title.dispatchEvent(createPointerEvent("pointerdown", { clientX: 200, clientY: 125, pointerId: 41 }));
        window.dispatchEvent(createPointerEvent("pointerup", { clientX: 200, clientY: 125, pointerId: 41 }));
      });

      expect(getElement("[data-testid='text-style-toolbar']")).toBeTruthy();
      const observeCallsAfterSelect = resizeObserverInstances.reduce((count, instance) => count + instance.observe.mock.calls.length, 0);
      expect(resizeObserverMock).toHaveBeenCalledTimes(1);
      expect(observeCallsAfterSelect).toBe(observeCallsBeforeSelect);
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
      await act(async () => {
        root.unmount();
      });
    }
  });

  it("shows a floating text toolbar and applies block text styles", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const title = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(title, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 100, width: 420, height: 72 })
    });
    title.style.fontSize = "88px";
    title.style.color = "rgb(24, 32, 31)";
    title.style.fontWeight = "400";

    await act(async () => {
      title.dispatchEvent(createPointerEvent("pointerdown", { clientX: 260, clientY: 132, pointerId: 11 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 260, clientY: 132, pointerId: 11 }));
    });

    expect(getElement("[data-testid='text-style-toolbar']")).toBeTruthy();
    expect(getElement(".text-style-size").textContent).toBe("88");
    expect([...getElement<HTMLSelectElement>("[aria-label='Font family']").options].map((option) => option.textContent)).toEqual(
      expect.arrayContaining(["主题默认", "黑体", "Georgia", "优设标题黑", "钉钉进步体", "字体传奇雪家黑", "Glow Sans ExtraBold", "Noto Sans CJK SC"])
    );

    await act(async () => {
      const select = getElement<HTMLSelectElement>("[aria-label='Font family']");
      select.value = "YouSheTitleHei";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-font-size-increase']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-color-#e23d28']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-bold-toggle']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-line-height-increase']").click();
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-letter-spacing-increase']").click();
    });

    const titleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    expect(titleBlock.dataset.textStyle).toBe("custom");
    expect(titleBlock.closest(".slide-content")).toBeTruthy();
    expect(document.querySelector(".preview-pane .slide-text-layer [data-text-block='title']")).toBeNull();
    expect(titleBlock.style.getPropertyValue("--text-font-size")).toBe("92px");
    expect(titleBlock.style.getPropertyValue("--text-font-family")).toBe("YouSheTitleHei");
    expect(titleBlock.style.getPropertyValue("--text-color")).toBe("#e23d28");
    expect(titleBlock.style.getPropertyValue("--text-font-weight")).toBe("800");
    expect(titleBlock.style.getPropertyValue("--text-line-height")).toBe("1.1");
    expect(titleBlock.style.getPropertyValue("--text-letter-spacing")).toBe("0.5px");
    expect(titleBlock.style.getPropertyValue("--text-w")).toBe("");

    const styledTitle = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
    await act(async () => {
      styledTitle.dispatchEvent(createPointerEvent("pointerdown", { clientX: 260, clientY: 132, pointerId: 12 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 300, clientY: 152, pointerId: 12 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 300, clientY: 152, pointerId: 12 }));
    });

    const movedTitleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    expect(movedTitleBlock.closest(".slide-text-layer")).toBeTruthy();
    expect(movedTitleBlock.dataset.textLayout).toBe("free");
    expect(movedTitleBlock.style.getPropertyValue("--text-font-size")).toBe("92px");
    expect(movedTitleBlock.style.getPropertyValue("--text-font-family")).toBe("YouSheTitleHei");
    expect(movedTitleBlock.style.getPropertyValue("--text-color")).toBe("#e23d28");
    expect(movedTitleBlock.style.getPropertyValue("--text-font-weight")).toBe("800");
    expect(movedTitleBlock.style.getPropertyValue("--text-line-height")).toBe("1.1");
    expect(movedTitleBlock.style.getPropertyValue("--text-letter-spacing")).toBe("0.5px");
  });

  it("keeps the rendered title size when only changing text color", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const title = getElement<HTMLElement>(".preview-pane .slide-text-block--title h1");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(title, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 100, width: 520, height: 96 })
    });
    title.style.fontSize = "104px";
    title.style.color = "rgb(24, 32, 31)";
    title.style.fontWeight = "400";

    await act(async () => {
      title.dispatchEvent(createPointerEvent("pointerdown", { clientX: 320, clientY: 148, pointerId: 13 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 320, clientY: 148, pointerId: 13 }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-color-#e23d28']").click();
    });

    const titleBlock = getElement<HTMLElement>(".preview-pane .slide-text-block--title");
    expect(titleBlock.closest(".slide-content")).toBeTruthy();
    expect(titleBlock.dataset.textLayout).toBeUndefined();
    expect(document.querySelector(".preview-pane .slide-text-layer [data-text-block='title']")).toBeNull();
    expect(titleBlock.style.getPropertyValue("--text-font-size")).toBe("104px");
    expect(titleBlock.style.getPropertyValue("--text-color")).toBe("#e23d28");
  });

  it("applies text column controls without collapsing independent bullet blocks on click", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能
- 画图技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-flow-two']").click();
    });

    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--two");
    expect(document.querySelectorAll(".preview-pane [data-text-block^='block-']").length).toBe(3);

    const firstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    Object.defineProperty(firstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 120, y: 180, width: 260, height: 42 })
    });
    Object.defineProperty(getElement<HTMLElement>(".preview-pane .slide-canvas"), "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });

    await act(async () => {
      firstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 250, clientY: 201, pointerId: 61 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 250, clientY: 201, pointerId: 61 }));
    });

    expect(getElement(".preview-pane .slide-text-flow").className).toContain("slide-text-flow--two");
    expect(document.querySelectorAll(".preview-pane .slide-text-flow [data-text-block^='block-']").length).toBe(3);
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textLayout).toBeUndefined();
    expect(getElement(".preview-pane [data-text-block='block-1']").closest(".slide-text-flow")).toBeTruthy();
    expect(document.querySelector(".preview-pane .slide-text-layer [data-text-block='block-1']")).toBeNull();
  });

  it("keeps a selected grid bullet card in flow until it is dragged", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# 当前挑战

- 课堂材料分散
- 学生注意力难持续
- 课后复盘缺少结构`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: { "slide-1": "grid" },
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const firstBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const firstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(firstBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 360, y: 120, width: 320, height: 96 })
    });
    Object.defineProperty(firstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 382, y: 145, width: 156, height: 34 })
    });

    await act(async () => {
      firstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 460, clientY: 162, pointerId: 66 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 460, clientY: 162, pointerId: 66 }));
    });

    const selectedBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    expect(selectedBlock.closest(".slide-text-flow")).toBeTruthy();
    expect(selectedBlock.dataset.textSelected).toBe("true");
    expect(selectedBlock.dataset.textLayout).toBeUndefined();
    expect(document.querySelector(".preview-pane .slide-text-layer [data-text-block='block-1']")).toBeNull();
    expect(document.querySelectorAll(".preview-pane .slide-text-flow [data-text-block^='block-']").length).toBe(3);
    expect(selectedBlock.textContent).toContain("课堂材料分散");
    expect(selectedBlock.textContent).not.toContain("学生注意力难持续");
    expect(getElement(".preview-pane [data-text-block='block-2']").closest(".slide-text-flow")).toBeTruthy();

    const refreshedSelectedBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const refreshedFirstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    Object.defineProperty(refreshedSelectedBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 360, y: 120, width: 320, height: 96 })
    });
    Object.defineProperty(refreshedFirstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 382, y: 145, width: 156, height: 34 })
    });
    await act(async () => {
      refreshedFirstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 460, clientY: 162, pointerId: 67 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 500, clientY: 187, pointerId: 67 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 500, clientY: 187, pointerId: 67 }));
    });

    const movedBlock = getElement<HTMLElement>(".preview-pane .slide-text-layer [data-text-block='block-1']");
    expect(movedBlock.dataset.textFlow).toBe("grid");
    expect(movedBlock.style.getPropertyValue("--text-x")).toBe("56%");
    expect(movedBlock.style.getPropertyValue("--text-y")).toBe("38.6%");
    expect(movedBlock.style.getPropertyValue("--text-w")).toBe("32%");
  });

  it("styles one independent bullet block without changing sibling bullets", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const firstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(firstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 120, y: 180, width: 260, height: 42 })
    });
    firstBullet.style.fontSize = "26px";
    firstBullet.style.color = "rgb(24, 32, 31)";

    await act(async () => {
      firstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 250, clientY: 201, pointerId: 71 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 250, clientY: 201, pointerId: 71 }));
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-color-#e23d28']").click();
    });

    const styledBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const siblingBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    expect(styledBlock.style.getPropertyValue("--text-color")).toBe("#e23d28");
    expect(styledBlock.closest(".slide-text-flow")).toBeTruthy();
    expect(styledBlock.dataset.textLayout).toBeUndefined();
    expect(document.querySelector(".preview-pane .slide-text-layer [data-text-block='block-1']")).toBeNull();
    expect(siblingBlock.closest(".slide-text-flow")).toBeTruthy();
    expect(siblingBlock.style.getPropertyValue("--text-color")).toBe("");
  });

  it("makes text flow override an older whole-body free text layout", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能
- 画图技能
- 视频技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: {},
        textLayouts: {
          "slide-1": {
            body: { x: 48, y: 58, width: 72 },
            blocks: {
              "block-1": { x: 30, y: 40, mode: "free", width: 24 }
            }
          }
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(getElement(".preview-pane [data-text-block='body'][data-text-layout='free']")).toBeTruthy();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-flow-grid']").click();
    });

    const flow = getElement(".preview-pane .slide-text-flow");
    expect(flow.className).toContain("slide-text-flow--grid");
    expect(document.querySelector(".preview-pane [data-text-block='body'][data-text-layout='free']")).toBeNull();
    expect(getElement(".preview-pane [data-text-block='block-1']").closest(".slide-text-layer")).toBeTruthy();
    expect(getElement(".preview-pane [data-text-block='block-2']").closest(".slide-text-flow")).toBe(flow);
    expect(getElement(".status").textContent).toContain("已解除旧正文整体布局");
  });

  it("moves ctrl-selected text blocks together while keeping style edits on the primary block", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能
- 画图技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: { "slide-1": "two" },
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const firstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    const secondBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(firstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 150, width: 220, height: 40 })
    });
    Object.defineProperty(secondBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    firstBullet.style.fontSize = "26px";
    firstBullet.style.color = "rgb(24, 32, 31)";
    secondBullet.style.fontSize = "26px";
    secondBullet.style.color = "rgb(24, 32, 31)";

    await act(async () => {
      firstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 210, clientY: 170, pointerId: 81, ctrlKey: true }));
    });
    const refreshedSecondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    const refreshedSecondList = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] ul");
    const refreshedSecondBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(refreshedSecondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    Object.defineProperty(refreshedSecondList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    Object.defineProperty(refreshedSecondBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    refreshedSecondBullet.style.fontSize = "26px";
    refreshedSecondBullet.style.color = "rgb(24, 32, 31)";
    await act(async () => {
      refreshedSecondBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 540, clientY: 170, pointerId: 82, ctrlKey: true }));
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").dataset.textSelected).toBe("true");
    expect(getElement("[data-testid='text-style-toolbar']")).toBeTruthy();

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-color-#e23d28']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-color")).toBe("#e23d28");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-color")).toBe("");

    const currentFirstBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const currentFirstList = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] ul");
    const currentFirstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    const currentSecondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    const currentSecondList = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] ul");
    const selectedSecondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(currentFirstBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 150, width: 220, height: 40 })
    });
    Object.defineProperty(currentFirstList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 150, width: 220, height: 40 })
    });
    Object.defineProperty(currentFirstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 150, width: 220, height: 40 })
    });
    Object.defineProperty(currentSecondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    Object.defineProperty(currentSecondList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    Object.defineProperty(selectedSecondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 150, width: 240, height: 40 })
    });
    await act(async () => {
      selectedSecondBlock.dispatchEvent(createPointerEvent("pointerdown", { clientX: 540, clientY: 170, pointerId: 83 }));
      window.dispatchEvent(createPointerEvent("pointermove", { clientX: 640, clientY: 220, pointerId: 83 }));
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 640, clientY: 220, pointerId: 83 }));
    });

    const movedFirst = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const movedSecond = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    expect(movedFirst.closest(".slide-text-layer")).toBeTruthy();
    expect(movedSecond.closest(".slide-text-layer")).toBeTruthy();
    expect(movedFirst.style.getPropertyValue("--text-x")).toBe("31%");
    expect(movedFirst.style.getPropertyValue("--text-y")).toBe("44%");
    expect(movedSecond.style.getPropertyValue("--text-x")).toBe("64%");
    expect(movedSecond.style.getPropertyValue("--text-y")).toBe("44%");
    expect(movedSecond.style.getPropertyValue("--text-color")).toBe("#e23d28");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='text-flow-one']").click();
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-text-block='block-3'] li").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 260, clientY: 260, pointerId: 84 })
      );
      window.dispatchEvent(createPointerEvent("pointerup", { clientX: 260, clientY: 260, pointerId: 84 }));
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textSelected).toBeUndefined();
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-3']").dataset.textSelected).toBe("true");
  });

  it("aligns ctrl-selected text blocks and keeps them selected", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: { "slide-1": "two" },
        textLayouts: {}
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const canvas = getElement<HTMLElement>(".preview-pane .slide-canvas");
    const firstBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const firstList = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] ul");
    const firstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    const secondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    const secondList = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] ul");
    const secondBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 500 })
    });
    Object.defineProperty(firstBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(firstList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(firstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(secondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(secondList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(secondBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });

    await act(async () => {
      firstBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 210, clientY: 180, pointerId: 91, ctrlKey: true }));
    });
    const refreshedSecondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    const refreshedSecondList = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] ul");
    const refreshedSecondBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(refreshedSecondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(refreshedSecondList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(refreshedSecondBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    await act(async () => {
      refreshedSecondBullet.dispatchEvent(createPointerEvent("pointerdown", { clientX: 540, clientY: 260, pointerId: 92, ctrlKey: true }));
    });
    const selectedFirstBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-1']");
    const selectedFirstList = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] ul");
    const selectedFirstBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-1'] li");
    const selectedSecondBlock = getElement<HTMLElement>(".preview-pane [data-text-block='block-2']");
    const selectedSecondList = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] ul");
    const selectedSecondBullet = getElement<HTMLElement>(".preview-pane [data-text-block='block-2'] li");
    Object.defineProperty(selectedFirstBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(selectedFirstList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(selectedFirstBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 100, y: 160, width: 220, height: 40 })
    });
    Object.defineProperty(selectedSecondBlock, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(selectedSecondList, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    Object.defineProperty(selectedSecondBullet, "getBoundingClientRect", {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 420, y: 240, width: 240, height: 40 })
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='align-top']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-y")).toBe("36%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-y")).toBe("36%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").dataset.textSelected).toBe("true");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='align-center-horizontal']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-x")).toBe("38%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-x")).toBe("38%");
    expect(getElement(".status").textContent).toContain("已对齐 2 个文本框");
  });

  it("undoes and redoes text alignment from the preview controls", async () => {
    localStorage.setItem(
      "ai-ppt:draft",
      JSON.stringify({
        markdown: `# Skills

- 插件市场
- 翻译技能`,
        themeId: "business-report",
        assets: [],
        imageLayouts: {},
        slideCompositions: {},
        slideTextFlows: { "slide-1": "two" },
        textLayouts: {
          "slide-1": {
            blocks: {
              "block-1": { x: 21, y: 36, mode: "free", width: 22 },
              "block-2": { x: 54, y: 52, mode: "free", width: 24 }
            }
          }
        }
      })
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 210, clientY: 180, pointerId: 111, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 540, clientY: 260, pointerId: 112, ctrlKey: true })
      );
    });
    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='align-center-horizontal']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-x")).toBe("38%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-x")).toBe("38%");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='undo-edit']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-x")).toBe("21%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-x")).toBe("54%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").dataset.textSelected).toBe("true");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").dataset.textSelected).toBe("true");

    await act(async () => {
      getElement<HTMLButtonElement>("[data-testid='redo-edit']").click();
    });

    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-1']").style.getPropertyValue("--text-x")).toBe("38%");
    expect(getElement<HTMLElement>(".preview-pane [data-text-block='block-2']").style.getPropertyValue("--text-x")).toBe("38%");
  });
});

function getElement<T extends Element = Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Expected element not found: ${selector}`);
  }
  return element;
}

function createPointerEvent(type: string, init: { clientX: number; clientY: number; pointerId: number; ctrlKey?: boolean; metaKey?: boolean }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId },
    ctrlKey: { value: "ctrlKey" in init ? init.ctrlKey : false },
    metaKey: { value: "metaKey" in init ? init.metaKey : false }
  });
  return event;
}

function createKeyboardEvent(type: string, init: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false
  });
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, value);
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
}
