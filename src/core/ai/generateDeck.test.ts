import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDeck, generateOutline, type GenerateOutlineInput, type GeneratedOutline } from "./generateDeck";

const input: GenerateOutlineInput = {
  topic: "AI PPT 使用课",
  scenario: "lesson",
  audience: "小白用户",
  slideCount: 6,
  tone: "清晰教学"
};

const outline: GeneratedOutline = {
  title: "AI PPT 使用课",
  slides: [
    {
      id: "slide-1",
      title: "为什么要用 AI PPT",
      bullets: ["节省搭结构时间"],
      purpose: "cover"
    }
  ]
};

describe("AI deck generation client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts generation input to the outline endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(outline), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(generateOutline(input)).resolves.toEqual(outline);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate-outline",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input)
      })
    );
  });

  it("surfaces friendly server errors from outline generation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "还没有配置 DeepSeek API Key，请先在 .env 里填写 DEEPSEEK_API_KEY。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(generateOutline(input)).rejects.toThrow("还没有配置 DeepSeek API Key");
  });

  it("posts the confirmed outline to the deck endpoint", async () => {
    const result = {
      markdown: "# AI PPT 使用课\n\n---\n\n## 为什么要用",
      themeId: "teaching-whiteboard",
      slideCompositions: { "slide-1": "cover-stage" },
      slideTextFlows: { "slide-2": "two" },
      speakerNotes: { "slide-1": "开场讲稿" },
      slideIntents: { "slide-1": "建立共识" },
      revealPlan: { "slide-1": "标题先出，再出要点" }
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(generateDeck(input, outline)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate-deck",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ input, outline })
      })
    );
  });
});
