export interface SlideTextBlocks {
  titleHtml: string;
  bodyHtml: string;
  bodyBlocks: SlideContentTextBlock[];
}

export interface SlideContentTextBlock {
  id: string;
  kind: "paragraph" | "list-item" | "code" | "table" | "quote" | "html";
  html: string;
  plainText: string;
  sourceIndex: number;
}

export function splitSlideTextBlocks(html: string): SlideTextBlocks {
  const heading = html.match(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/i);
  if (!heading || heading.index === undefined) {
    const bodyHtml = html.trim();
    return {
      titleHtml: "",
      bodyHtml,
      bodyBlocks: splitBodyBlocks(bodyHtml)
    };
  }

  const bodyHtml = `${html.slice(0, heading.index)}${html.slice(heading.index + heading[0].length)}`.trim();
  return {
    titleHtml: heading[0],
    bodyHtml,
    bodyBlocks: splitBodyBlocks(bodyHtml)
  };
}

function splitBodyBlocks(html: string): SlideContentTextBlock[] {
  const normalized = html.trim();
  if (!normalized) return [];

  const blocks: SlideContentTextBlock[] = [];
  const tokenPattern =
    /<(p|ul|ol|pre|blockquote|table)\b[\s\S]*?<\/\1>|<span\b(?=[^>]*\bslide-image-frame\b)[\s\S]*?<\/span><\/span>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  let cursor = 0;

  while ((match = tokenPattern.exec(normalized))) {
    const looseHtml = normalized.slice(cursor, match.index).trim();
    if (looseHtml) {
      blocks.push(toBlock(looseHtml, "html", index));
      index += 1;
    }
    const tag = (match[1] ?? "").toLowerCase();
    const chunk = match[0];
    if (tag === "ul" || tag === "ol") {
      const listItems = [...chunk.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)];
      listItems.forEach((itemMatch) => {
        const itemHtml = `<${tag}>${itemMatch[0]}</${tag}>`;
        blocks.push(toBlock(itemHtml, "list-item", index));
        index += 1;
      });
    } else {
      blocks.push(toBlock(chunk, blockKindForTag(tag), index));
      index += 1;
    }
    cursor = tokenPattern.lastIndex;
  }

  const trailingHtml = normalized.slice(cursor).trim();
  if (trailingHtml) {
    blocks.push(toBlock(trailingHtml, "html", index));
  }

  if (blocks.length === 0) {
    return [toBlock(normalized, "html", 0)];
  }

  return blocks;
}

function blockKindForTag(tag: string): SlideContentTextBlock["kind"] {
  if (tag === "p") return "paragraph";
  if (tag === "pre") return "code";
  if (tag === "table") return "table";
  if (tag === "blockquote") return "quote";
  return "html";
}

function toBlock(html: string, kind: SlideContentTextBlock["kind"], sourceIndex: number): SlideContentTextBlock {
  return {
    id: `block-${sourceIndex + 1}`,
    kind,
    html,
    plainText: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    sourceIndex
  };
}
