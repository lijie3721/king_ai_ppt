const revealTagPattern = /<(h[1-3]|p|li|blockquote|pre|table|span)(\s[^>]*)?>/gi;

export function countRevealItems(html: string): number {
  let count = 0;
  html.replace(revealTagPattern, (_match, tag: string, attrs = "") => {
    if (isRevealTag(tag, attrs)) count += 1;
    return _match;
  });
  return count;
}

export function annotateRevealItems(html: string, revealStep?: number): string {
  let index = 0;
  return html.replace(revealTagPattern, (match, tag: string, attrs = "") => {
    if (!isRevealTag(tag, attrs)) return match;
    const stateClass =
      revealStep === undefined
        ? "is-hidden"
        : index <= revealStep
          ? `is-revealed${index === revealStep ? " is-current" : ""}`
          : "is-hidden";
    const nextAttrs = addRevealAttrs(attrs, index, `reveal-item ${stateClass}`);
    index += 1;
    return `<${tag}${nextAttrs}>`;
  });
}

function isRevealTag(tag: string, attrs: string): boolean {
  if (tag.toLowerCase() !== "span") return true;
  return /\bslide-image-frame\b/.test(attrs) && /\sdata-asset-id=(["'])/.test(attrs);
}

function addRevealAttrs(attrs: string, revealIndex: number, className: string): string {
  const revealAttr = ` data-reveal-index="${revealIndex}"`;
  if (/\sclass=(["'])/i.test(attrs)) {
    return attrs.replace(/\sclass=(["'])(.*?)\1/i, (_match, quote, existingClass) => {
      return ` class=${quote}${existingClass} ${className}${quote}${revealAttr}`;
    });
  }
  return `${attrs} class="${className}"${revealAttr}`;
}
