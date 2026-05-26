import { describe, expect, it } from "vitest";
import {
  buildInlineImageMarkdown,
  buildImageAsset,
  buildImageSlideMarkdown,
  insertImageIntoSlide,
  insertImageMarkdown,
  isImageTooLarge
} from "./imageInsert";
import { parseMarkdownDeck } from "../markdown/deck";

describe("image insertion helpers", () => {
  it("builds a short asset-reference image slide from a file data URL", () => {
    const asset = buildImageAsset({
      fileName: "classroom-photo.jpg",
      dataUrl: "data:image/jpeg;base64,abc123",
      sizeBytes: 128,
      now: 123456
    });
    const markdown = buildImageSlideMarkdown({
      fileName: "classroom-photo.jpg",
      assetId: asset.id
    });

    expect(asset).toMatchObject({
      name: "classroom-photo.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,abc123",
      sizeBytes: 128,
      createdAt: 123456
    });
    expect(markdown).toContain("## classroom-photo");
    expect(markdown).toContain(`![classroom-photo](asset:${asset.id})`);
    expect(markdown).not.toContain("data:image");

    const deck = parseMarkdownDeck(markdown, [asset]);
    expect(deck.slides[0].layout).toBe("image-hero");
    expect(deck.slides[0].html).toContain("data:image/jpeg;base64,abc123");
  });

  it("inserts image Markdown at the current cursor position", () => {
    const source = "# Title\n\nIntro";
    const image = buildImageSlideMarkdown({
      fileName: "diagram.png",
      assetId: "img_test"
    });
    const result = insertImageMarkdown({
      source,
      insertText: image,
      selectionStart: source.length,
      selectionEnd: source.length
    });

    expect(result.value).toBe(`${source}\n\n${image}`);
    expect(result.cursor).toBe(result.value.length);
  });

  it("inserts inline image Markdown into the selected slide without adding a new slide", () => {
    const source = "# One\n\nIntro\n\n---\n\n## Two\n\nBody\n\n---\n\n## Three\n\nEnd";
    const image = buildInlineImageMarkdown({
      fileName: "diagram.png",
      assetId: "img_test"
    });
    const result = insertImageIntoSlide({
      source,
      slideIndex: 1,
      insertText: image
    });
    const deck = parseMarkdownDeck(result.value);

    expect(deck.slides).toHaveLength(3);
    expect(deck.slides[1].markdown).toContain("![diagram](asset:img_test)");
    expect(deck.slides[0].markdown).not.toContain("asset:img_test");
    expect(deck.slides[2].markdown).not.toContain("asset:img_test");
  });

  it("appends as a new slide when cursor information is unavailable", () => {
    const result = insertImageMarkdown({
      source: "# Title",
      insertText: "## image\n\n![image](asset:img_test)"
    });

    expect(result.value).toBe("# Title\n\n---\n\n## image\n\n![image](asset:img_test)");
  });

  it("detects images over the size limit", () => {
    expect(isImageTooLarge(3 * 1024 * 1024, 3)).toBe(false);
    expect(isImageTooLarge(3 * 1024 * 1024 + 1, 3)).toBe(true);
  });
});
