# PPT Custom Fonts

This directory stores project-owned fonts for the AI PPT editor.

Registered fonts appear in the text style toolbar and are emitted as font assets by Vite.

Registered fonts:

- `Zhiyong Elegant.ttf`
- `SmileySans-Oblique.otf.woff2`
- `AlimamaDongFangDaKai-Regular.woff2`
- `优设标题黑.ttf`
- `字魂扁桃体.ttf`
- `钉钉进步体.ttf`
- `新叶念体.otf`
- `杨任东竹石体-Bold.ttf`
- `手书体.ttf`
- `今年也要加油鸭.ttf`
- `庞门正道真贵楷体.ttf`
- `字体传奇雪家黑.ttf`
- `演示斜黑体.otf`
- `NotoSansCJKsc-Regular.otf`
- `GlowSansJ-Compressed-Regular.otf`
- `GlowSansJ-Compressed-Medium.otf`
- `GlowSansJ-Compressed-ExtraBold.otf`
- `文泉驿微米黑 Lite.ttc`

To add another font:

1. Put the font file in this directory.
2. Import it in `src/core/fonts/fontCatalog.ts` with `?inline`.
3. Add it to `customFontFaces`.

Prefer `.woff2`. Large CJK fonts make the built app and exported deck heavier.
