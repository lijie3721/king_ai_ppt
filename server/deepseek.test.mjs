import { describe, expect, it } from "vitest";
import {
  buildDeckMessages,
  buildOutlineMessages,
  buildOptimizationMessages,
  extractChatCompletionText,
  isMissingDeepSeekKey,
  normalizeDeckResponse,
  normalizeOutlineResponse,
  parseJsonObjectFromModel,
  parseEnvFile
} from "./deepseek.mjs";

describe("DeepSeek server helpers", () => {
  it("parses simple .env content without exposing quotes or comments", () => {
    expect(
      parseEnvFile(`
# local settings
DEEPSEEK_API_KEY="sk-test"
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL='deepseek-v4-flash'
`)
    ).toEqual({
      DEEPSEEK_API_KEY: "sk-test",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-v4-flash"
    });
  });

  it("treats absent and placeholder keys as missing", () => {
    expect(isMissingDeepSeekKey(undefined)).toBe(true);
    expect(isMissingDeepSeekKey("")).toBe(true);
    expect(isMissingDeepSeekKey("replace_with_your_deepseek_key")).toBe(true);
    expect(isMissingDeepSeekKey("sk-real")).toBe(false);
  });

  it("extracts Markdown from DeepSeek chat completions", () => {
    expect(
      extractChatCompletionText({
        choices: [
          {
            message: {
              content: "# Optimized\n\n---\n\n## Slide"
            }
          }
        ]
      })
    ).toBe("# Optimized\n\n---\n\n## Slide");
  });

  it("builds a teaching-clear optimization prompt with concrete slide constraints", () => {
    const messages = buildOptimizationMessages({
      markdown: "# 草稿",
      intent: "lesson",
      themeId: "business-report"
    });

    expect(messages[0].content).toContain("讲课清晰型");
    expect(messages[0].content).toContain("2-4 个短要点");
    expect(messages[0].content).toContain("18-28 字");
    expect(messages[0].content).toContain("保留图片语法");
    expect(messages[0].content).toContain("不改视觉配置");
    expect(messages[0].content).toContain("return only Markdown");
    expect(messages[1].content).toContain("# 草稿");
  });

  it("builds an outline prompt that requires structured JSON and the requested slide count", () => {
    const messages = buildOutlineMessages({
      topic: "AI PPT 使用课",
      scenario: "lesson",
      audience: "小白用户",
      slideCount: 6,
      tone: "清晰教学",
      sourceMaterial: "已有资料"
    });

    expect(messages[0].content).toContain("必须只返回 JSON");
    expect(messages[0].content).toContain("slideCount");
    expect(messages[1].content).toContain("AI PPT 使用课");
    expect(messages[1].content).toContain("页数：6");
    expect(messages[1].content).toContain("已有资料");
  });

  it("builds a deck prompt that asks for markdown, theme, compositions, and notes", () => {
    const messages = buildDeckMessages({
      input: {
        topic: "AI PPT 使用课",
        scenario: "lesson",
        audience: "小白用户",
        slideCount: 6,
        tone: "清晰教学"
      },
      outline: {
        title: "AI PPT 使用课",
        slides: [{ id: "slide-1", title: "开场", bullets: [], purpose: "cover" }]
      }
    });

    expect(messages[0].content).toContain("\"markdown\"");
    expect(messages[0].content).toContain("\"themeId\"");
    expect(messages[0].content).toContain("\"slideCompositions\"");
    expect(messages[0].content).toContain("\"slideTextFlows\"");
    expect(messages[0].content).toContain("\"speakerNotes\"");
    expect(messages[0].content).toContain("\"slideIntents\"");
    expect(messages[0].content).toContain("\"revealPlan\"");
    expect(messages[0].content).toContain("不要输出 HTML");
    expect(messages[1].content).toContain("确认大纲");
  });

  it("extracts JSON objects from fenced model output", () => {
    expect(parseJsonObjectFromModel("```json\n{\"title\":\"课件\"}\n```")).toEqual({ title: "课件" });
  });

  it("normalizes generated outline and deck responses", () => {
    expect(
      normalizeOutlineResponse(
        {
          title: " 课件 ",
          slides: [
            { id: "slide-1", title: "封面", bullets: [" 要点 "], purpose: "cover" },
            { title: "方法", bullets: ["A", "B", "C", "D", "E"], purpose: "method" }
          ]
        },
        2
      )
    ).toEqual({
      title: "课件",
      slides: [
        { id: "slide-1", title: "封面", bullets: ["要点"], purpose: "cover" },
        { id: "slide-2", title: "方法", bullets: ["A", "B", "C", "D"], purpose: "method" }
      ]
    });

    expect(
      normalizeDeckResponse({
        markdown: " # 课件 ",
        themeId: "teaching-whiteboard",
        slideCompositions: { "slide-1": "cover-stage" },
        slideTextFlows: { "slide-1": "two", "slide-2": "bad" },
        speakerNotes: { "slide-1": "开场讲稿" },
        slideIntents: { "slide-1": "建立共识" },
        revealPlan: { "slide-1": "标题先出，再出要点" }
      })
    ).toEqual({
      markdown: "# 课件",
      themeId: "teaching-whiteboard",
      slideCompositions: { "slide-1": "cover-stage" },
      slideTextFlows: { "slide-1": "two" },
      speakerNotes: { "slide-1": "开场讲稿" },
      slideIntents: { "slide-1": "建立共识" },
      revealPlan: { "slide-1": "标题先出，再出要点" }
    });
  });
});
