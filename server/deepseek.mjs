import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(filePath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(filePath)) return;

  const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());
    if (key) env[key] = value;
  }

  return env;
}

export function isMissingDeepSeekKey(apiKey) {
  return !apiKey || apiKey.trim() === "" || apiKey.trim() === "replace_with_your_deepseek_key";
}

export function getDeepSeekConfig(env = process.env) {
  return {
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: trimTrailingSlash(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"),
    model: env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  };
}

export async function callDeepSeek({ apiKey, baseUrl, model, markdown, intent, themeId }) {
  const messages = buildOptimizationMessages({ markdown, intent, themeId });
  return callDeepSeekMessages({ apiKey, baseUrl, model, messages, temperature: 0.4 });
}

export async function callDeepSeekMessages({ apiKey, baseUrl, model, messages, temperature = 0.4 }) {
  const result = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages
    })
  });

  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(data.error?.message || "DeepSeek request failed.");
  }

  const text = extractChatCompletionText(data);
  if (!text) {
    throw new Error("DeepSeek returned an empty optimization.");
  }
  return text.trim();
}

export function buildOptimizationMessages({ markdown, intent, themeId }) {
  return [
    {
      role: "system",
      content:
        "You optimize Markdown copy and page breaks for a 16:9 HTML slide deck in 讲课清晰型 style. Preserve facts and prices; do not invent claims. Use --- between slides. Each slide should have one clear title and 2-4 个短要点 when it is a list slide. For Chinese bullets, keep each bullet around 18-28 字. Split long content into more slides instead of squeezing it into one page. Prefer punchy teaching rhythm: hook, pain, method, example, action. 保留图片语法 and keep existing Markdown image syntax if images already exist. 不改视觉配置 such as theme, fonts, colors, manual layouts, or logo. Do not output HTML, explanations, code fences, or notes; return only Markdown."
    },
    {
      role: "user",
      content: `Intent: ${intent || "lesson"}\nTheme: ${themeId || "default"}\n\nMarkdown:\n${markdown}`
    }
  ];
}

export function buildOutlineMessages(input) {
  return [
    {
      role: "system",
      content:
        "你是资深中文课程与汇报 PPT 策划。根据用户输入先生成可编辑大纲，不要直接写完整 PPT。必须只返回 JSON，不要 markdown、解释或代码围栏。JSON 结构为 {\"title\":\"...\",\"subtitle\":\"...\",\"slides\":[{\"id\":\"slide-1\",\"title\":\"...\",\"bullets\":[\"...\"],\"purpose\":\"cover|context|problem|method|example|summary|action\"}]}。页数必须等于用户要求的 slideCount。每页 bullets 0-4 条，每条 12-28 个中文字符。结构要适合真实讲课或汇报：开场、问题/背景、方法、例子、总结行动。"
    },
    {
      role: "user",
      content: `主题：${input.topic}
场景：${input.scenario}
受众：${input.audience}
页数：${input.slideCount}
语气：${input.tone}

资料：
${input.sourceMaterial || "无补充资料"}`
    }
  ];
}

export function buildDeckMessages({ input, outline }) {
  return [
    {
      role: "system",
      content:
        "你是资深中文 HTML PPT 制作助手。把用户确认后的大纲生成 Markdown 幻灯片，同时补全讲稿和页面策略。必须只返回 JSON，不要解释或代码围栏。JSON 结构为 {\"markdown\":\"...\",\"themeId\":\"business-report|teaching-whiteboard|tech-night|swiss-grid|editorial-magazine|executive-noir|fresh-keynote|neon-studio|chinese-poster|mono-paper\",\"slideCompositions\":{\"slide-1\":\"cover-stage\"},\"slideTextFlows\":{\"slide-1\":\"auto|one|two|three|grid\"},\"speakerNotes\":{\"slide-1\":\"...\"},\"slideIntents\":{\"slide-1\":\"...\"},\"revealPlan\":{\"slide-1\":\"...\"}}。markdown 用 --- 分隔页面，每页一个清晰标题，列表页 2-4 个短要点。speakerNotes 写成能直接照着讲的中文讲稿，每页 80-180 字。slideIntents 用一句话说明这一页的讲述目标。revealPlan 用一句话说明适合按标题、段落、要点或图片逐步出现。不要编造资料中没有的事实、数字、价格。不要输出 HTML。所有对象的 key 必须使用 slide-1、slide-2 这种顺序 ID。"
    },
    {
      role: "user",
      content: `生成需求：
${JSON.stringify(input, null, 2)}

确认大纲：
${JSON.stringify(outline, null, 2)}`
    }
  ];
}

export function parseJsonObjectFromModel(text) {
  const trimmed = String(text || "").trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("DeepSeek returned invalid JSON.");
  }
  return JSON.parse(withoutFence.slice(start, end + 1));
}

export function normalizeOutlineResponse(value, expectedSlideCount) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI 返回的大纲格式不完整，可以重试一次，或减少资料长度。");
  }
  const title = typeof value.title === "string" && value.title.trim() ? value.title.trim() : "未命名课件";
  const slides = Array.isArray(value.slides) ? value.slides.map(normalizeOutlineSlide).filter(Boolean) : [];
  if (slides.length === 0) {
    throw new Error("AI 返回的大纲格式不完整，可以重试一次，或减少资料长度。");
  }
  return {
    title,
    ...(typeof value.subtitle === "string" && value.subtitle.trim() ? { subtitle: value.subtitle.trim() } : {}),
    slides: slides.slice(0, expectedSlideCount)
  };
}

export function normalizeDeckResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.markdown !== "string" || value.markdown.trim().length === 0) {
    throw new Error("AI 返回的 PPT 内容不完整，可以重试一次。");
  }
  return {
    markdown: value.markdown.trim(),
    themeId: typeof value.themeId === "string" && value.themeId.trim() ? value.themeId.trim() : "teaching-whiteboard",
    slideCompositions: isPlainObject(value.slideCompositions) ? value.slideCompositions : {},
    slideTextFlows: parseSlideTextFlows(value.slideTextFlows),
    speakerNotes: parseStringMap(value.speakerNotes),
    slideIntents: parseStringMap(value.slideIntents),
    revealPlan: parseStringMap(value.revealPlan)
  };
}

export function extractChatCompletionText(data) {
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function normalizeOutlineSlide(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.title !== "string" || !value.title.trim()) {
    return undefined;
  }
  const purpose = isOutlinePurpose(value.purpose) ? value.purpose : index === 0 ? "cover" : "method";
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : `slide-${index + 1}`,
    title: value.title.trim(),
    bullets: Array.isArray(value.bullets) ? value.bullets.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4) : [],
    purpose
  };
}

function isOutlinePurpose(value) {
  return value === "cover" || value === "context" || value === "problem" || value === "method" || value === "example" || value === "summary" || value === "action";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStringMap(value) {
  if (!isPlainObject(value)) return undefined;
  const entries = Object.entries(value).filter((entry) => typeof entry[0] === "string" && typeof entry[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseSlideTextFlows(value) {
  if (!isPlainObject(value)) return undefined;
  const entries = Object.entries(value).filter((entry) => typeof entry[0] === "string" && isSlideTextFlowMode(entry[1]));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isSlideTextFlowMode(value) {
  return value === "auto" || value === "one" || value === "two" || value === "three" || value === "grid";
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
