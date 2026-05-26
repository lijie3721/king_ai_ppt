import http from "node:http";
import {
  buildDeckMessages,
  buildOutlineMessages,
  callDeepSeek,
  callDeepSeekMessages,
  getDeepSeekConfig,
  isMissingDeepSeekKey,
  loadEnvFile,
  normalizeDeckResponse,
  normalizeOutlineResponse,
  parseJsonObjectFromModel
} from "./deepseek.mjs";

loadEnvFile();

const port = Number(process.env.AI_PPT_API_PORT ?? 4174);

const server = http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/optimize-markdown") {
    await handleOptimizeMarkdown(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate-outline") {
    await handleGenerateOutline(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate-deck") {
    await handleGenerateDeck(request, response);
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI PPT API listening at http://127.0.0.1:${port}`);
});

async function handleOptimizeMarkdown(request, response) {
  try {
    const body = await readJson(request);
    if (!body || typeof body.markdown !== "string" || body.markdown.trim().length === 0) {
      sendJson(response, 400, { error: "Markdown is required." });
      return;
    }

    const config = getDeepSeekConfig();
    if (isMissingDeepSeekKey(config.apiKey)) {
      sendJson(response, 400, {
        error: "还没有配置 DeepSeek API Key，请先在 .env 里填写 DEEPSEEK_API_KEY。"
      });
      return;
    }

    const optimized = await callDeepSeek({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      markdown: body.markdown,
      intent: body.intent,
      themeId: body.themeId
    });

    sendJson(response, 200, {
      markdown: optimized,
      notes: ["Optimized slide rhythm, hierarchy, and page breaks."]
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "AI optimization failed."
    });
  }
}

async function handleGenerateOutline(request, response) {
  try {
    const body = await readJson(request);
    const input = normalizeGenerationInput(body);
    if (!input) {
      sendJson(response, 400, { error: "请先填写课件主题。" });
      return;
    }

    const config = getDeepSeekConfig();
    if (isMissingDeepSeekKey(config.apiKey)) {
      sendJson(response, 400, {
        error: "还没有配置 DeepSeek API Key，请先在 .env 里填写 DEEPSEEK_API_KEY。"
      });
      return;
    }

    const text = await callDeepSeekMessages({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages: buildOutlineMessages(input),
      temperature: 0.45
    });
    sendJson(response, 200, normalizeOutlineResponse(parseJsonObjectFromModel(text), input.slideCount));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "AI 大纲生成失败。"
    });
  }
}

async function handleGenerateDeck(request, response) {
  try {
    const body = await readJson(request);
    const input = normalizeGenerationInput(body?.input);
    if (!input || !body?.outline || typeof body.outline !== "object") {
      sendJson(response, 400, { error: "请先生成并确认课件大纲。" });
      return;
    }

    const config = getDeepSeekConfig();
    if (isMissingDeepSeekKey(config.apiKey)) {
      sendJson(response, 400, {
        error: "还没有配置 DeepSeek API Key，请先在 .env 里填写 DEEPSEEK_API_KEY。"
      });
      return;
    }

    const text = await callDeepSeekMessages({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages: buildDeckMessages({ input, outline: body.outline }),
      temperature: 0.5
    });
    sendJson(response, 200, normalizeDeckResponse(parseJsonObjectFromModel(text)));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "AI PPT 生成失败。"
    });
  }
}

function normalizeGenerationInput(body) {
  if (!body || typeof body !== "object" || typeof body.topic !== "string" || body.topic.trim().length === 0) {
    return undefined;
  }
  return {
    topic: body.topic.trim(),
    scenario: typeof body.scenario === "string" ? body.scenario : "lesson",
    audience: typeof body.audience === "string" && body.audience.trim() ? body.audience.trim() : "小白用户",
    slideCount: normalizeSlideCount(body.slideCount),
    tone: typeof body.tone === "string" && body.tone.trim() ? body.tone.trim() : "清晰教学",
    sourceMaterial: typeof body.sourceMaterial === "string" ? body.sourceMaterial.slice(0, 12000) : ""
  };
}

function normalizeSlideCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 6;
  return Math.min(Math.max(Math.round(count), 3), 20);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_500_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
