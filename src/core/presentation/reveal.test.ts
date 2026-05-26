import { describe, expect, it } from "vitest";
import { annotateRevealItems, countRevealItems } from "./reveal";

describe("presentation reveal helpers", () => {
  it("counts text and slide image frames in source order", () => {
    const html = `<h2>Title</h2><p>Intro</p><span class="slide-image-frame" data-asset-id="img_one"><img src="one.png"></span><p>Outro</p>`;

    expect(countRevealItems(html)).toBe(4);
  });

  it("annotates image frames with continuous reveal indexes", () => {
    const html = `<h2>Title</h2><span class="slide-image-frame" data-asset-id="img_one"><img src="one.png"></span><p>Caption</p>`;
    const annotated = annotateRevealItems(html, 1);

    expect(annotated).toContain('<h2 class="reveal-item is-revealed" data-reveal-index="0">');
    expect(annotated).toContain('class="slide-image-frame reveal-item is-revealed is-current" data-reveal-index="1"');
    expect(annotated).toContain('<p class="reveal-item is-hidden" data-reveal-index="2">');
  });
});
