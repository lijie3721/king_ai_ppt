import { describe, expect, it } from "vitest";
import { parseMarkdownDeck } from "../markdown/deck";
import { createStandaloneHtml } from "./exportDeck";
import { themes } from "../themes/themes";

describe("createStandaloneHtml", () => {
  it("exports a single html document with theme css, font faces, and runtime", () => {
    const deck = parseMarkdownDeck(`# Quarterly Review

Growth, risks, next steps.

---

## Next

- Ship editor
- Test export`);

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Quarterly Review");
    expect(html).toContain("--slide-bg");
    expect(html).toContain('@font-face { font-family: "YouSheTitleHei"');
    expect(html).toContain('@font-face { font-family: "DingTalkJinBuTi"');
    expect(html).toContain('@font-face { font-family: "ZiTiChuanQiXueJiaHei"');
    expect(html).toContain('@font-face { font-family: "GlowSansCompressedExtraBold"');
    expect(html).toContain('@font-face { font-family: "WenQuanYiMicroHeiLite"');
    expect(html).toContain("data-slide-index=\"0\"");
    expect(html).toContain("window.addEventListener(\"keydown\"");
    expect(html).not.toContain("http://127.0.0.1");
  });

  it("exports newly added visual theme css into the standalone deck", () => {
    const deck = parseMarkdownDeck(`# AI 发布会

新产品节奏。`);

    const html = createStandaloneHtml(deck, themes["neon-studio"]);

    expect(html).toContain("--slide-bg: #090b12");
    expect(html).toContain("--slide-accent: #54f5d2");
    expect(html).toContain("--slide-bg-base");
    expect(html).toContain("--slide-bg-detail");
    expect(html).toContain("--slide-bg-wash");
    expect(html).toContain("var(--slide-bg-base");
    expect(html).toContain("var(--slide-bg-detail");
    expect(html).toContain('font-family: "GlowSansCompressedExtraBold"');
  });

  it("exports readability controls for Chinese teaching slides", () => {
    const deck = parseMarkdownDeck(`## AI 工具课开场

- 未来淘汰你的不是程序员，而是会用AI指挥程序做产品的人。
- 痛点：听过AI热词但没用起来？3天训练营带你做出第一个AI小工具。
- 我是Alex，49.9三天直播，从0到1教你AI工具并变现。`);

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain("overflow-wrap: break-word");
    expect(html).toContain(".slide--bullets ul");
    expect(html).toContain("minmax(0, 1fr)");
  });

  it("exports asset images as inline data URLs instead of asset references", () => {
    const deck = parseMarkdownDeck(
      `## 图片页

![课堂图](asset:img_class)`,
      [
        {
          id: "img_class",
          name: "class.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ]
    );

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain("data:image/png;base64,abc123");
    expect(html).not.toContain("asset:img_class");
  });

  it("exports saved image position and size", () => {
    const deck = parseMarkdownDeck(
      `## 图片页

![课堂图](asset:img_class)`,
      [
        {
          id: "img_class",
          name: "class.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ],
      {
        img_class: { x: 68, y: 54, width: 46 }
      }
    );

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain('data-image-layout="free"');
    expect(html).toContain("--image-x:68%");
    expect(html).toContain("--image-y:54%");
    expect(html).toContain("--image-w:46%");
    expect(html).toContain(".slide-image-frame[data-image-layout=\"free\"]");
    expect(html).toContain(".slide__content {\n  position: relative;");
    expect(html).toContain("overflow: visible;");
    expect(html).toContain('class="slide__image-layer"');
  });

  it("exports manual slide compositions", () => {
    const deck = parseMarkdownDeck(`# Title

Intro

---

## Details

- One
- Two`);

    const html = createStandaloneHtml(deck, themes["business-report"], {
      "slide-2": "right-heavy"
    });

    expect(html).toContain("slide-composition--right-heavy");
    expect(html).toContain(".slide-composition--right-heavy");
  });

  it("exports manual title and body positions", () => {
    const deck = parseMarkdownDeck(`# Title

Intro

- One`);

    const html = createStandaloneHtml(deck, themes["business-report"], {}, undefined, "top-right", {
      "slide-1": {
        title: {
          x: 30,
          y: 24,
          width: 48,
          style: { fontSize: 68, fontFamily: "serif", color: "#e23d28", bold: true, lineHeight: 1.2, letterSpacing: 1.5 }
        },
        body: { x: 58, y: 60, width: 32 }
      }
    });

    expect(html).toContain('class="slide-text-block slide-text-block--title"');
    expect(html).toContain('class="slide__text-layer"');
    expect(html).toContain('data-text-block="title" data-text-layout="free" data-text-style="custom" style="--text-x:30%;--text-y:24%;--text-w:48%;--text-font-size:68px;--text-font-family:serif;--text-color:#e23d28;--text-font-weight:800;--text-line-height:1.2;--text-list-gap:9.6px;--text-letter-spacing:1.5px"');
    expect(html).toContain('data-text-block="body" data-text-layout="free" style="--text-x:58%;--text-y:60%;--text-w:32%"');
    expect(html).toContain(".slide-text-block[data-text-layout=\"free\"]");
    expect(html).toContain("width: var(--text-w, min(90%, 980px));");
    expect(html).toContain(".slide-text-block[data-text-layout=\"free\"] > :is(h1, h2, h3, p, ul, ol)");
    expect(html).toContain(".slide-text-block[data-text-style=\"custom\"][style*=\"--text-font-size\"] > *");
    expect(html).toContain(".slide-text-block[data-text-style=\"custom\"][style*=\"--text-line-height\"] :is(h1, h2, h3, p, li)");
    expect(html).toContain(".slide-text-block[data-text-style=\"custom\"][style*=\"--text-line-height\"] :is(ul, ol) { gap: var(--text-list-gap); }");
    expect(html).toContain(".slide-text-block[data-text-style=\"custom\"][style*=\"--text-letter-spacing\"] :is(h1, h2, h3, p, li)");
    expect(html).toContain(".slide__text-layer");
  });

  it("lets explicit text flow override older whole-body free text layout in export", () => {
    const deck = parseMarkdownDeck(`# Skills

- 插件市场
- 翻译技能
- 画图技能`);

    const html = createStandaloneHtml(
      deck,
      themes["business-report"],
      {},
      undefined,
      "top-right",
      { "slide-1": "grid" },
      {
        "slide-1": {
          body: { x: 58, y: 60, width: 32 },
          blocks: {
            "block-1": { x: 30, y: 40, width: 24 }
          }
        }
      }
    );

    expect(html).toContain("slide-text-flow--grid");
    expect(html).not.toContain('data-text-block="body" data-text-layout="free"');
    expect(html).toContain('data-text-block="block-1" data-text-layout="free"');
    expect(html).toContain('data-text-block="block-2"');
  });

  it("exports a brand logo on every slide", () => {
    const deck = parseMarkdownDeck(`# Title

Intro

---

## Details

- One
- Two`);

    const html = createStandaloneHtml(
      deck,
      themes["business-report"],
      {},
      {
        id: "logo_asset",
        name: "logo.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,logo123",
        sizeBytes: 100,
        createdAt: 1
      },
      "top-right"
    );

    expect(html).toContain('class="slide-logo slide-logo--top-right"');
    expect(html.match(/class="slide-logo slide-logo--top-right"/g)).toHaveLength(2);
    expect(html).toContain("data:image/png;base64,logo123");
    expect(html).toContain(".slide--logo-top-right .slide__number");
  });

  it("exports presentation text animations with reduced motion support", () => {
    const deck = parseMarkdownDeck(`# Title

Intro

---

## Details

- One
- Two`);

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain("@keyframes pptTextIn");
    expect(html).toContain(".reveal-item.is-current");
    expect(html).toContain(".reveal-item.is-hidden");
    expect(html).toContain("prefers-reduced-motion: reduce");
  });

  it("exports block reveal runtime for presentation keyboard control", () => {
    const deck = parseMarkdownDeck(`# 第一页

开场段落

- 要点一
- 要点二

---

## 第二页

结束`);

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain('data-reveal-index="0"');
    expect(html).toContain(".reveal-item.is-hidden");
    expect(html).toContain("advanceRevealOrSlide");
    expect(html).toContain('"Enter"');
    expect(html).toContain("data-reveal-step");
  });

  it("exports speaker notes metadata for future presenter mode", () => {
    const deck = parseMarkdownDeck(`# 第一页

开场`);

    const html = createStandaloneHtml(
      deck,
      themes["business-report"],
      {},
      undefined,
      "top-right",
      {},
      {},
      { "slide-1": "开场讲稿" },
      { "slide-1": "建立共识" },
      { "slide-1": "标题先出" }
    );

    expect(html).toContain('id="ai-ppt-speaker-notes"');
    expect(html).toContain('"speakerNotes":{"slide-1":"开场讲稿"}');
    expect(html).toContain('"slideIntents":{"slide-1":"建立共识"}');
    expect(html).toContain('"slideRevealPlans":{"slide-1":"标题先出"}');
  });

  it("exports image frames as reveal items in Markdown order", () => {
    const deck = parseMarkdownDeck(
      `## 图片页

开场

![第一张](asset:img_one)

补充

![第二张](asset:img_two)`,
      [
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
      {
        img_two: { x: 70, y: 50, width: 36 }
      }
    );

    const html = createStandaloneHtml(deck, themes["business-report"]);

    expect(html).toContain('data-reveal-count="5"');
    expect(html).toContain('data-reveal-index="2" data-asset-id="img_one"');
    expect(html).toContain('data-reveal-index="4" data-asset-id="img_two"');
    expect(html).toContain("sort((a, b) => Number(a.dataset.revealIndex) - Number(b.dataset.revealIndex))");
  });
});
