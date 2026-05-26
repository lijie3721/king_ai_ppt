import { describe, expect, it } from "vitest";
import { splitSlideTextBlocks } from "./textBlocks";

describe("splitSlideTextBlocks", () => {
  it("splits paragraphs and list items into independent deterministic blocks", () => {
    const blocks = splitSlideTextBlocks("<h2>标题</h2><p>第一段</p><ul><li>要点一</li><li>要点二</li></ul><p>第二段</p>");

    expect(blocks.titleHtml).toBe("<h2>标题</h2>");
    expect(blocks.bodyBlocks.map((block) => [block.id, block.kind, block.plainText])).toEqual([
      ["block-1", "paragraph", "第一段"],
      ["block-2", "list-item", "要点一"],
      ["block-3", "list-item", "要点二"],
      ["block-4", "paragraph", "第二段"]
    ]);
    expect(blocks.bodyBlocks[1].html).toBe("<ul><li>要点一</li></ul>");
  });

  it("keeps inline image frames in body order when splitting text blocks", () => {
    const blocks = splitSlideTextBlocks(
      '<h2>图片页</h2><p>开场</p><span class="slide-image-frame" data-asset-id="img_one"><img src="x"><span class="image-resize-handle" aria-hidden="true"></span></span><p>补充</p>'
    );

    expect(blocks.bodyBlocks.map((block) => block.plainText)).toEqual(["开场", "", "补充"]);
    expect(blocks.bodyBlocks[1].html).toContain('data-asset-id="img_one"');
  });
});
