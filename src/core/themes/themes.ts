export interface SlideTheme {
  id: string;
  name: string;
  description: string;
  css: string;
}

export const themes: Record<string, SlideTheme> = {
  "business-report": {
    id: "business-report",
    name: "Business Report",
    description: "Calm boardroom pages for updates, reviews, and decisions.",
    css: `
      --slide-bg: #f7f4ec;
      --slide-surface: #fffdf7;
      --slide-ink: #18201f;
      --slide-muted: #68706f;
      --slide-accent: #a34722;
      --slide-rule: rgba(24, 32, 31, 0.14);
      --slide-code-bg: #17201f;
      --slide-code-ink: #f8f2e5;
      --slide-font-title: "Georgia", "Times New Roman", serif;
      --slide-font-body: "Avenir Next", "Helvetica Neue", sans-serif;
    `
  },
  "teaching-whiteboard": {
    id: "teaching-whiteboard",
    name: "Teaching Whiteboard",
    description: "Readable lesson slides with generous spacing and clear hierarchy.",
    css: `
      --slide-bg: #fbfbf6;
      --slide-surface: #ffffff;
      --slide-ink: #20221e;
      --slide-muted: #62665f;
      --slide-accent: #2f7d72;
      --slide-rule: rgba(47, 125, 114, 0.18);
      --slide-code-bg: #22302e;
      --slide-code-ink: #eff8ef;
      --slide-font-title: "Palatino", "Georgia", serif;
      --slide-font-body: "Gill Sans", "Avenir Next", sans-serif;
    `
  },
  "tech-night": {
    id: "tech-night",
    name: "Tech Night",
    description: "Dark technical talks with crisp code and high contrast.",
    css: `
      --slide-bg: #101312;
      --slide-surface: #171d1b;
      --slide-ink: #edf2eb;
      --slide-muted: #9aa59e;
      --slide-accent: #67d3b0;
      --slide-rule: rgba(237, 242, 235, 0.16);
      --slide-code-bg: #090b0a;
      --slide-code-ink: #d9ffe9;
      --slide-font-title: "Iowan Old Style", "Georgia", serif;
      --slide-font-body: "Menlo", "SF Mono", monospace;
    `
  },
  "swiss-grid": {
    id: "swiss-grid",
    name: "Swiss Grid",
    description: "Strict grid, bold scale, and restrained color for methodology decks.",
    css: `
      --slide-bg: #eeeeea;
      --slide-surface: #fdfdf8;
      --slide-ink: #111111;
      --slide-muted: #5b5b57;
      --slide-accent: #e23d28;
      --slide-rule: rgba(17, 17, 17, 0.2);
      --slide-code-bg: #111111;
      --slide-code-ink: #f5f5ef;
      --slide-font-title: "Helvetica Neue", "Arial", sans-serif;
      --slide-font-body: "Helvetica Neue", "Arial", sans-serif;
    `
  },
  "editorial-magazine": {
    id: "editorial-magazine",
    name: "Editorial Magazine",
    description: "Magazine-style contrast for talks that need more visual character.",
    css: `
      --slide-bg: #2b241c;
      --slide-surface: #f0e3cc;
      --slide-ink: #281f19;
      --slide-muted: #705d4d;
      --slide-accent: #b92735;
      --slide-rule: rgba(40, 31, 25, 0.18);
      --slide-code-bg: #2d211a;
      --slide-code-ink: #ffe9c9;
      --slide-font-title: "Didot", "Bodoni 72", "Georgia", serif;
      --slide-font-body: "Avenir Next", "Helvetica Neue", sans-serif;
    `
  },
  "executive-noir": {
    id: "executive-noir",
    name: "Executive Noir",
    description: "Black-gold executive decks for pitches, decisions, and high-stakes reports.",
    css: `
      --slide-bg: #090807;
      --slide-surface: #14110d;
      --slide-ink: #f4ead7;
      --slide-muted: #b6a98f;
      --slide-accent: #c9a45d;
      --slide-rule: rgba(244, 234, 215, 0.14);
      --slide-code-bg: #050403;
      --slide-code-ink: #f8e8bd;
      --slide-font-title: "GlowSansCompressedExtraBold", "Helvetica Neue", sans-serif;
      --slide-font-body: "NotoSansCJKsc", "Avenir Next", sans-serif;
      --slide-bg-base: radial-gradient(circle at 18% 18%, rgba(201, 164, 93, 0.2), transparent 28%), linear-gradient(135deg, #1c1711 0%, #0a0908 58%, #15100b 100%);
      --slide-bg-detail: linear-gradient(90deg, transparent 0 8%, rgba(201, 164, 93, 0.44) 8% 8.4%, transparent 8.4% 100%), linear-gradient(180deg, rgba(244, 234, 215, 0.08) 0 1px, transparent 1px 100%);
      --slide-bg-wash: linear-gradient(135deg, rgba(201, 164, 93, 0.18) 0 12%, transparent 12% 72%, rgba(201, 164, 93, 0.12) 72% 100%);
    `
  },
  "fresh-keynote": {
    id: "fresh-keynote",
    name: "Fresh Keynote",
    description: "Bright green keynote pages for product explainers, lessons, and workshops.",
    css: `
      --slide-bg: #eaf5ee;
      --slide-surface: #fbfff8;
      --slide-ink: #123127;
      --slide-muted: #5c776d;
      --slide-accent: #1faf72;
      --slide-rule: rgba(18, 49, 39, 0.13);
      --slide-code-bg: #123127;
      --slide-code-ink: #effff2;
      --slide-font-title: "DingTalkJinBuTi", "Helvetica Neue", sans-serif;
      --slide-font-body: "NotoSansCJKsc", "Avenir Next", sans-serif;
      --slide-bg-base: radial-gradient(circle at 88% 14%, rgba(31, 175, 114, 0.22), transparent 24%), linear-gradient(160deg, #fbfff8 0%, #f5fbf2 46%, #e3f5eb 100%);
      --slide-bg-detail: linear-gradient(135deg, transparent 0 58%, rgba(31, 175, 114, 0.12) 58% 74%, transparent 74% 100%), linear-gradient(90deg, rgba(18, 49, 39, 0.08) 1px, transparent 1px) 0 0 / 72px 72px;
      --slide-bg-wash: radial-gradient(circle at 10% 90%, rgba(255, 214, 107, 0.18), transparent 26%), linear-gradient(90deg, rgba(31, 175, 114, 0.08), transparent 42%);
    `
  },
  "neon-studio": {
    id: "neon-studio",
    name: "Neon Studio",
    description: "Electric dark pages for AI demos, launches, and technical storytelling.",
    css: `
      --slide-bg: #090b12;
      --slide-surface: #101522;
      --slide-ink: #eef7ff;
      --slide-muted: #93a6c5;
      --slide-accent: #54f5d2;
      --slide-rule: rgba(84, 245, 210, 0.2);
      --slide-code-bg: #060810;
      --slide-code-ink: #cffff4;
      --slide-font-title: "GlowSansCompressedExtraBold", "Helvetica Neue", sans-serif;
      --slide-font-body: "NotoSansCJKsc", "Menlo", monospace;
      --slide-bg-base: radial-gradient(circle at 72% 22%, rgba(84, 245, 210, 0.24), transparent 24%), radial-gradient(circle at 12% 84%, rgba(86, 121, 255, 0.2), transparent 30%), linear-gradient(145deg, #101522 0%, #060810 100%);
      --slide-bg-detail: linear-gradient(90deg, rgba(84, 245, 210, 0.17) 1px, transparent 1px) 0 0 / 56px 56px, linear-gradient(180deg, rgba(84, 245, 210, 0.12) 1px, transparent 1px) 0 0 / 56px 56px, linear-gradient(115deg, transparent 0 62%, rgba(84, 245, 210, 0.18) 62% 63%, transparent 63% 100%);
      --slide-bg-wash: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 7px), radial-gradient(circle at 50% 0%, rgba(84, 245, 210, 0.16), transparent 34%);
    `
  },
  "chinese-poster": {
    id: "chinese-poster",
    name: "Chinese Poster",
    description: "Red-black poster energy for marketing lessons, launches, and live courses.",
    css: `
      --slide-bg: #1b1110;
      --slide-surface: #f7ead4;
      --slide-ink: #21120f;
      --slide-muted: #73584e;
      --slide-accent: #d43125;
      --slide-rule: rgba(33, 18, 15, 0.18);
      --slide-code-bg: #21120f;
      --slide-code-ink: #ffe6bd;
      --slide-font-title: "AlimamaDongFangDaKai", "YouSheTitleHei", serif;
      --slide-font-body: "NotoSansCJKsc", "Avenir Next", sans-serif;
      --slide-bg-base: radial-gradient(circle at 12% 20%, rgba(212, 49, 37, 0.18), transparent 22%), linear-gradient(135deg, #f7ead4 0%, #f2dcb9 100%);
      --slide-bg-detail: linear-gradient(90deg, rgba(33, 18, 15, 0.18) 0 10px, transparent 10px calc(100% - 10px), rgba(33, 18, 15, 0.18) calc(100% - 10px) 100%), linear-gradient(180deg, rgba(33, 18, 15, 0.18) 0 10px, transparent 10px calc(100% - 10px), rgba(33, 18, 15, 0.18) calc(100% - 10px) 100%), radial-gradient(circle at 86% 18%, rgba(212, 49, 37, 0.22) 0 8%, transparent 8.5%);
      --slide-bg-wash: linear-gradient(135deg, transparent 0 66%, rgba(212, 49, 37, 0.18) 66% 82%, transparent 82% 100%), repeating-linear-gradient(0deg, rgba(33, 18, 15, 0.035) 0 1px, transparent 1px 5px);
    `
  },
  "mono-paper": {
    id: "mono-paper",
    name: "Mono Paper",
    description: "Minimal black-white-blue pages for consulting, research, and professional reports.",
    css: `
      --slide-bg: #f2f4f7;
      --slide-surface: #ffffff;
      --slide-ink: #0c1014;
      --slide-muted: #68717d;
      --slide-accent: #2457d6;
      --slide-rule: rgba(12, 16, 20, 0.12);
      --slide-code-bg: #0c1014;
      --slide-code-ink: #f2f6ff;
      --slide-font-title: "YouSheTitleHei", "Helvetica Neue", sans-serif;
      --slide-font-body: "NotoSansCJKsc", "Helvetica Neue", sans-serif;
      --slide-bg-base: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      --slide-bg-detail: linear-gradient(90deg, rgba(36, 87, 214, 0.2) 0 2px, transparent 2px 100%), linear-gradient(180deg, rgba(12, 16, 20, 0.08) 1px, transparent 1px) 0 0 / 100% 64px;
      --slide-bg-wash: linear-gradient(90deg, transparent 0 82%, rgba(36, 87, 214, 0.1) 82% 100%), linear-gradient(135deg, transparent 0 72%, rgba(12, 16, 20, 0.04) 72% 100%);
    `
  }
};

export const themeList = Object.values(themes);
