/**
 * A small Markdown parser for AI Coach replies. It produces a plain tree of
 * text nodes that the UI renders as React elements, so nothing in a reply
 * (or an error message) is ever interpreted as HTML.
 *
 * Supported: # to #### headings, **bold**, *italic* / _italic_, `code`,
 * ``` fences, - / * / + / • bullets, 1. numbered lists, > quotes, --- rules
 * and simple | tables.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; value: string };

export type TableAlign = "left" | "center" | "right" | null;

export interface ListItem {
  depth: number;
  children: InlineNode[];
}

export type BlockNode =
  | { type: "heading"; level: 1 | 2 | 3 | 4; children: InlineNode[] }
  | { type: "paragraph"; lines: InlineNode[][] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "code"; lang: string; value: string }
  | { type: "quote"; lines: InlineNode[][] }
  | { type: "rule" }
  | { type: "table"; align: TableAlign[]; header: InlineNode[][]; rows: InlineNode[][][] };

export const MAX_MARKDOWN_CHARS = 60_000;

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

function findClosing(text: string, marker: string, from: number): number {
  let index = text.indexOf(marker, from);
  while (index !== -1) {
    const before = text[index - 1];
    if (before && before !== " " && before !== "\t") {
      if (marker === "_" && isWordChar(text[index + 1])) {
        index = text.indexOf(marker, index + 1);
        continue;
      }
      return index;
    }
    index = text.indexOf(marker, index + 1);
  }
  return -1;
}

export function parseInline(text: string, depth: number = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) nodes.push({ type: "text", value: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length && /[\\`*_#>|[\]-]/.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        nodes.push({ type: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (depth < 4 && (text.startsWith("**", i) || text.startsWith("__", i))) {
      const marker = text.slice(i, i + 2);
      const next = text[i + 2];
      if (next && next !== " ") {
        const end = findClosing(text, marker, i + 2);
        if (end > i + 2) {
          flush();
          nodes.push({ type: "strong", children: parseInline(text.slice(i + 2, end), depth + 1) });
          i = end + 2;
          continue;
        }
      }
    }

    if (depth < 4 && (ch === "*" || ch === "_")) {
      const next = text[i + 1];
      const prev = text[i - 1];
      const opens = next && next !== " " && next !== ch && !(ch === "_" && isWordChar(prev));
      if (opens) {
        const end = findClosing(text, ch, i + 1);
        if (end > i + 1 && text[end + 1] !== ch) {
          flush();
          nodes.push({ type: "em", children: parseInline(text.slice(i + 1, end), depth + 1) });
          i = end + 1;
          continue;
        }
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
  return nodes;
}

// Model output is untrusted text: every pattern here runs in linear time
// (no two adjacent quantifiers that can match the same characters), so a
// crafted line cannot freeze the page.
const HEADING_START = /^(#{1,6})\s+/;
const BULLET = /^(\s*)([-*+•])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,4})[.)]\s+(.*)$/;
const FENCE = /^(```|~~~)[ \t]*([\w+-]*)$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;

/** "## Title ##" -> level 2, "Title" (closing hashes dropped). */
function parseHeading(line: string): { level: number; text: string } | null {
  const start = HEADING_START.exec(line);
  if (!start) return null;
  let text = line.slice(start[0].length).trimEnd();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end -= 1;
  if (end < text.length && (end === 0 || text[end - 1] === " " || text[end - 1] === "\t")) {
    text = text.slice(0, end).trimEnd();
  }
  return { level: start[1].length, text };
}

/** "| --- | :---: |" style line under a table header. */
function isTableSeparator(line: string): boolean {
  let row = line.trim();
  if (!row.includes("-")) return false;
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").every((cell) => SEPARATOR_CELL.test(cell.trim()));
}

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === "\\" && row[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (row[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += row[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseAlign(cell: string): TableAlign {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

const indentDepth = (indent: string) => Math.min(3, Math.floor(indent.replace(/\t/g, "  ").length / 2));

export function parseMarkdown(source: string): BlockNode[] {
  const text = (source || "").slice(0, MAX_MARKDOWN_CHARS).replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const blocks: BlockNode[] = [];
  let paragraph: InlineNode[][] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flushParagraph();
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line.trim());
    if (fence) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i].trim().startsWith(fence[1]) && lines[i].trim().replace(/[`~]/g, "") === "")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end of text)
      blocks.push({ type: "code", lang: fence[2] || "", value: body.join("\n") });
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, heading.level) as 1 | 2 | 3 | 4;
      blocks.push({ type: "heading", level, children: parseInline(heading.text) });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(parseAlign);
      const rows: InlineNode[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const cells = splitRow(lines[i]);
        rows.push(header.map((_, index) => parseInline(cells[index] || "")));
        i += 1;
      }
      blocks.push({
        type: "table",
        align: header.map((_, index) => align[index] ?? null),
        header: header.map((cell) => parseInline(cell)),
        rows,
      });
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph();
      const quoteLines: InlineNode[][] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoteLines.push(parseInline((QUOTE.exec(lines[i]) as RegExpExecArray)[1]));
        i += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = !bullet && !!ordered;
      const start = isOrdered && ordered ? Number(ordered[2]) : 1;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const b = BULLET.exec(lines[i]);
        const o = ORDERED.exec(lines[i]);
        const match = isOrdered ? o : b;
        if (match) {
          items.push({ depth: indentDepth(match[1]), children: parseInline(match[3]) });
          i += 1;
          continue;
        }
        // A nested list of the other kind stays inside this list.
        const other = isOrdered ? b : o;
        if (other && other[1].length > 0) {
          items.push({ depth: Math.max(1, indentDepth(other[1])), children: parseInline(other[3]) });
          i += 1;
          continue;
        }
        // An indented continuation line belongs to the previous item.
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].children.push({ type: "text", value: " " }, ...parseInline(lines[i].trim()));
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered: isOrdered, start, items });
      continue;
    }

    paragraph.push(parseInline(line.trim()));
    i += 1;
  }
  flushParagraph();
  return blocks;
}

/** Plain text of inline nodes (for labels and tests). */
export function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => (node.type === "text" || node.type === "code" ? node.value : inlineText(node.children)))
    .join("");
}
