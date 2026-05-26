import { describe, expect, it } from "vitest";
import { createFontFaceCss, customFontFaces, textStyleFonts } from "./fontCatalog";

describe("fontCatalog", () => {
  it("keeps the default toolbar font choices available", () => {
    expect(textStyleFonts).toEqual(
      expect.arrayContaining([
        { label: "主题默认", value: "" },
        { label: "黑体", value: "sans-serif" },
        { label: "Georgia", value: "Georgia" },
        { label: "优设标题黑", value: "YouSheTitleHei" },
        { label: "钉钉进步体", value: "DingTalkJinBuTi" },
        { label: "字体传奇雪家黑", value: "ZiTiChuanQiXueJiaHei" },
        { label: "Glow Sans ExtraBold", value: "GlowSansCompressedExtraBold" },
        { label: "Noto Sans CJK SC", value: "NotoSansCJKsc" }
      ])
    );
  });

  it("registers the project font set", () => {
    expect(customFontFaces.map((font) => font.family)).toEqual([
      "ZhiyongElegant",
      "SmileySansOblique",
      "AlimamaDongFangDaKai",
      "YouSheTitleHei",
      "ZiHunBianTaoTi",
      "DingTalkJinBuTi",
      "XinYeNianTi",
      "YangRenDongZhuShiBold",
      "Handwriting",
      "JinNianJiaYouYa",
      "PangMenZhengDaoZhenGuiKai",
      "ZiTiChuanQiXueJiaHei",
      "YanShiXieHei",
      "NotoSansCJKsc",
      "GlowSansCompressedRegular",
      "GlowSansCompressedMedium",
      "GlowSansCompressedExtraBold",
      "WenQuanYiMicroHeiLite"
    ]);
  });

  it("renders custom font faces for preview and exported html", () => {
    const css = createFontFaceCss([
      {
        label: "路飞标题体",
        family: "LuffyTitle",
        source: "data:font/woff2;base64,abc123",
        format: "woff2"
      },
      {
        label: "字体包",
        family: "FontCollection",
        source: "data:font/collection;base64,abc123",
        format: "collection"
      }
    ]);

    expect(css).toContain('@font-face { font-family: "LuffyTitle"');
    expect(css).toContain('src: url("data:font/woff2;base64,abc123") format("woff2")');
    expect(css).toContain('@font-face { font-family: "FontCollection"');
    expect(css).toContain('src: url("data:font/collection;base64,abc123") format("collection")');
    expect(css).toContain("font-display: swap");
  });
});
