# Custom Fonts

Place project font files in `src/assets/fonts/`, then import and register them in `fontCatalog.ts`.

Prefer `.woff2` so the editor and exported HTML stay smaller.

Example:

```ts
import luffyTitleFont from "../../assets/fonts/luffy-title.woff2?inline";

export const customFontFaces: CustomFontFace[] = [
  { label: "路飞标题体", family: "LuffyTitle", source: luffyTitleFont, format: "woff2" }
];
```

`label` is shown in the toolbar dropdown. `family` is the CSS font-family value saved into text styles and exported HTML.
