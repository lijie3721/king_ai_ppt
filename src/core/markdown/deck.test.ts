import { describe, expect, it } from "vitest";
import { parseMarkdownDeck } from "./deck";

describe("parseMarkdownDeck", () => {
  it("splits slides on horizontal separators and infers common layouts", () => {
    const deck = parseMarkdownDeck(`# Teaching AI

Make better lectures.

---

## Why it matters

- Faster outlines
- Better rhythm

---

## Demo code

\`\`\`ts
const slide = "ready";
\`\`\`

---

## Field photo

![Classroom](https://example.com/classroom.jpg)

A quick note.`);

    expect(deck.slides).toHaveLength(4);
    expect(deck.slides.map((slide) => slide.layout)).toEqual([
      "cover",
      "bullets",
      "code",
      "image-hero"
    ]);
    expect(deck.slides[1].html).toContain("<li>Faster outlines</li>");
  });

  it("keeps empty and unsafe input from breaking rendering", () => {
    const deck = parseMarkdownDeck(`<script>alert("x")</script>

<a href="javascript:alert(1)">bad</a>`);

    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].html).not.toContain("<script>");
    expect(deck.slides[0].html).not.toContain("javascript:");
  });

  it("keeps teaching bullets readable instead of treating long Chinese items as columns", () => {
    const deck = parseMarkdownDeck(`## AI 工具课开场

- 未来淘汰你的不是程序员，而是会用AI指挥程序做产品的人。
- 痛点：听过AI热词但没用起来？3天训练营带你做出第一个AI小工具。
- 我是Alex，49.9三天直播，从0到1教你AI工具并变现。`);

    expect(deck.slides[0].layout).toBe("bullets");
    expect(deck.slides[0].html).toContain("<li>未来淘汰你的不是程序员");
  });

  it("uses image-hero when a slide includes Markdown image syntax", () => {
    const deck = parseMarkdownDeck(`## 课堂现场

![学员正在看投影](https://example.com/class.jpg)

用一张图建立场景感。`);

    expect(deck.slides[0].layout).toBe("image-hero");
  });

  it("keeps base64 data image URLs renderable for offline exports", () => {
    const deck = parseMarkdownDeck(`## 本地图片

![本地图片](data:image/png;base64,abc123)`);

    expect(deck.slides[0].layout).toBe("image-hero");
    expect(deck.slides[0].html).toContain("data:image/png;base64,abc123");
  });

  it("resolves asset image URLs to their local data URLs", () => {
    const deck = parseMarkdownDeck(
      `## 本地图片

![本地图片](asset:img_local)`,
      [
        {
          id: "img_local",
          name: "local.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ]
    );

    expect(deck.slides[0].layout).toBe("image-hero");
    expect(deck.slides[0].html).toContain("data:image/png;base64,abc123");
    expect(deck.slides[0].html).toContain('data-asset-id="img_local"');
    expect(deck.slides[0].imageAssetIds).toEqual(["img_local"]);
    expect(deck.slides[0].html).not.toContain("asset:img_local");
  });

  it("resolves asset image IDs that contain Chinese characters", () => {
    const deck = parseMarkdownDeck(
      `## 431图片1

![431图片1](asset:img_431图片1_mpgqgxqw)`,
      [
        {
          id: "img_431图片1_mpgqgxqw",
          name: "431图片1.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ]
    );

    expect(deck.slides[0].html).toContain("data:image/png;base64,abc123");
    expect(deck.slides[0].html).toContain('data-asset-id="img_431图片1_mpgqgxqw"');
    expect(deck.slides[0].html).not.toContain("Missing image");
  });

  it("applies saved asset image layout styles", () => {
    const deck = parseMarkdownDeck(
      `## 本地图片

![本地图片](asset:img_local)`,
      [
        {
          id: "img_local",
          name: "local.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ],
      {
        img_local: { x: 70, y: 52, width: 44 }
      }
    );

    expect(deck.slides[0].html).toContain('data-image-layout="free"');
    expect(deck.slides[0].html).toContain("--image-x:70%");
    expect(deck.slides[0].html).toContain("--image-y:52%");
    expect(deck.slides[0].html).toContain("--image-w:44%");
  });

  it("does not wrap standalone asset images in paragraphs", () => {
    const deck = parseMarkdownDeck(
      `## 本地图片

![本地图片](asset:img_local)`,
      [
        {
          id: "img_local",
          name: "local.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,abc123",
          sizeBytes: 100,
          createdAt: 1
        }
      ],
      {
        img_local: { x: 0, y: 100, width: 120 }
      }
    );

    expect(deck.slides[0].html).toContain('<span class="slide-image-frame"');
    expect(deck.slides[0].html).not.toContain('<p><span class="slide-image-frame"');
  });

  it("shows a readable missing image placeholder when an asset is absent", () => {
    const deck = parseMarkdownDeck(`## 缺图

![封面图](asset:missing)`);

    expect(deck.slides[0].html).toContain("Missing image: 封面图");
  });
});
