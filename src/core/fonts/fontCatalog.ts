import alimamaDongFangDaKaiFont from "../../assets/fonts/AlimamaDongFangDaKai-Regular.woff2?url";
import glowSansCompressedExtraBoldFont from "../../assets/fonts/GlowSansJ-Compressed-ExtraBold.otf?url";
import glowSansCompressedMediumFont from "../../assets/fonts/GlowSansJ-Compressed-Medium.otf?url";
import glowSansCompressedRegularFont from "../../assets/fonts/GlowSansJ-Compressed-Regular.otf?url";
import notoSansCjkScFont from "../../assets/fonts/NotoSansCJKsc-Regular.otf?url";
import smileySansObliqueFont from "../../assets/fonts/SmileySans-Oblique.otf.woff2?url";
import wenQuanYiMicroHeiLiteFont from "../../assets/fonts/文泉驿微米黑 Lite.ttc?url";
import zhiyongElegantFont from "../../assets/fonts/Zhiyong Elegant.ttf?url";
import jinNianJiaYouYaFont from "../../assets/fonts/今年也要加油鸭.ttf?url";
import youSheTitleHeiFont from "../../assets/fonts/优设标题黑.ttf?url";
import ziTiChuanQiXueJiaHeiFont from "../../assets/fonts/字体传奇雪家黑.ttf?url";
import ziHunBianTaoTiFont from "../../assets/fonts/字魂扁桃体.ttf?url";
import pangMenZhengDaoZhenGuiKaiFont from "../../assets/fonts/庞门正道真贵楷体.ttf?url";
import handwritingFont from "../../assets/fonts/手书体.ttf?url";
import xinYeNianTiFont from "../../assets/fonts/新叶念体.otf?url";
import yangRenDongZhuShiBoldFont from "../../assets/fonts/杨任东竹石体-Bold.ttf?url";
import yanShiXieHeiFont from "../../assets/fonts/演示斜黑体.otf?url";
import dingTalkJinBuTiFont from "../../assets/fonts/钉钉进步体.ttf?url";

export interface TextStyleFontOption {
  label: string;
  value: string;
}

export interface CustomFontFace {
  label: string;
  family: string;
  source: string;
  format?: "woff2" | "woff" | "truetype" | "opentype" | "collection";
}

export const systemTextStyleFonts: TextStyleFontOption[] = [
  { label: "主题默认", value: "" },
  { label: "黑体", value: "sans-serif" },
  { label: "衬线", value: "serif" },
  { label: "等宽", value: "monospace" },
  { label: "Georgia", value: "Georgia" },
  { label: "Menlo", value: "Menlo" }
];

export const customFontFaces: CustomFontFace[] = [
  { label: "志勇优雅体", family: "ZhiyongElegant", source: zhiyongElegantFont, format: "truetype" },
  { label: "得意黑斜体", family: "SmileySansOblique", source: smileySansObliqueFont, format: "woff2" },
  { label: "阿里妈妈东方大楷", family: "AlimamaDongFangDaKai", source: alimamaDongFangDaKaiFont, format: "woff2" },
  { label: "优设标题黑", family: "YouSheTitleHei", source: youSheTitleHeiFont, format: "truetype" },
  { label: "字魂扁桃体", family: "ZiHunBianTaoTi", source: ziHunBianTaoTiFont, format: "truetype" },
  { label: "钉钉进步体", family: "DingTalkJinBuTi", source: dingTalkJinBuTiFont, format: "truetype" },
  { label: "新叶念体", family: "XinYeNianTi", source: xinYeNianTiFont, format: "opentype" },
  { label: "杨任东竹石体 Bold", family: "YangRenDongZhuShiBold", source: yangRenDongZhuShiBoldFont, format: "truetype" },
  { label: "手书体", family: "Handwriting", source: handwritingFont, format: "truetype" },
  { label: "今年也要加油鸭", family: "JinNianJiaYouYa", source: jinNianJiaYouYaFont, format: "truetype" },
  { label: "庞门正道真贵楷体", family: "PangMenZhengDaoZhenGuiKai", source: pangMenZhengDaoZhenGuiKaiFont, format: "truetype" },
  { label: "字体传奇雪家黑", family: "ZiTiChuanQiXueJiaHei", source: ziTiChuanQiXueJiaHeiFont, format: "truetype" },
  { label: "演示斜黑体", family: "YanShiXieHei", source: yanShiXieHeiFont, format: "opentype" },
  { label: "Noto Sans CJK SC", family: "NotoSansCJKsc", source: notoSansCjkScFont, format: "opentype" },
  { label: "Glow Sans Regular", family: "GlowSansCompressedRegular", source: glowSansCompressedRegularFont, format: "opentype" },
  { label: "Glow Sans Medium", family: "GlowSansCompressedMedium", source: glowSansCompressedMediumFont, format: "opentype" },
  { label: "Glow Sans ExtraBold", family: "GlowSansCompressedExtraBold", source: glowSansCompressedExtraBoldFont, format: "opentype" },
  { label: "文泉驿微米黑 Lite", family: "WenQuanYiMicroHeiLite", source: wenQuanYiMicroHeiLiteFont, format: "collection" }
];

export const textStyleFonts: TextStyleFontOption[] = [
  ...systemTextStyleFonts,
  ...customFontFaces.map((font) => ({ label: font.label, value: font.family }))
];

export function createFontFaceCss(fontFaces: CustomFontFace[] = customFontFaces): string {
  return fontFaces
    .map((font) => {
      const format = font.format ?? "woff2";
      return `@font-face { font-family: "${escapeCssString(font.family)}"; src: url("${escapeCssUrl(font.source)}") format("${format}"); font-display: swap; }`;
    })
    .join("\n");
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeCssUrl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "%22").replace(/\n/g, "");
}
