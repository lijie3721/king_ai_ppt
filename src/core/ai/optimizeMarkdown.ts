export interface OptimizeMarkdownRequest {
  markdown: string;
  intent?: "lesson" | "report";
  themeId?: string;
}

export interface OptimizeMarkdownResponse {
  markdown: string;
  notes?: string[];
}

export async function optimizeMarkdown(
  payload: OptimizeMarkdownRequest
): Promise<OptimizeMarkdownResponse> {
  const response = await fetch("/api/optimize-markdown", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json().catch(() => ({}))) as Partial<OptimizeMarkdownResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "AI optimization failed.");
  }

  if (typeof data.markdown !== "string") {
    throw new Error("AI optimization returned an invalid response.");
  }

  return {
    markdown: data.markdown,
    notes: Array.isArray(data.notes) ? data.notes : undefined
  };
}
