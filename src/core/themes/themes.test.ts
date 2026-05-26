import { describe, expect, it } from "vitest";
import { themeList, themes } from "./themes";

describe("themes", () => {
  it("includes visually distinct preset themes for different presentation moods", () => {
    expect(themeList.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["executive-noir", "fresh-keynote", "neon-studio", "chinese-poster", "mono-paper"])
    );
  });

  it("defines the required slide variables for every theme", () => {
    const requiredVariables = [
      "--slide-bg",
      "--slide-surface",
      "--slide-ink",
      "--slide-muted",
      "--slide-accent",
      "--slide-rule",
      "--slide-code-bg",
      "--slide-code-ink",
      "--slide-font-title",
      "--slide-font-body"
    ];

    for (const theme of themeList) {
      for (const variable of requiredVariables) {
        expect(theme.css).toContain(variable);
      }
    }
  });

  it("uses bundled custom fonts in the new visual themes", () => {
    expect(themes["executive-noir"].css).toContain("GlowSansCompressedExtraBold");
    expect(themes["fresh-keynote"].css).toContain("DingTalkJinBuTi");
    expect(themes["chinese-poster"].css).toContain("AlimamaDongFangDaKai");
  });

  it("adds rich css background layers to the new visual themes", () => {
    const richThemeIds = ["executive-noir", "fresh-keynote", "neon-studio", "chinese-poster", "mono-paper"];

    for (const themeId of richThemeIds) {
      expect(themes[themeId].css).toContain("--slide-bg-base");
      expect(themes[themeId].css).toContain("--slide-bg-detail");
      expect(themes[themeId].css).toContain("--slide-bg-wash");
    }
  });
});
