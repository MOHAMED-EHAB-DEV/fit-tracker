import React, { useMemo } from "react";
import { parseMarkdown, type BlockNode, type InlineNode } from "@/lib/assistant/markdown";

/**
 * Renders AI Coach text. Every piece of text becomes a React text node, so
 * HTML in a reply or an error message is displayed literally, never run.
 */

function renderInline(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case "strong":
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderInline(node.children, key)}
          </strong>
        );
      case "em":
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        );
      case "code":
        return (
          <code key={key} className="px-1.5 py-0.5 rounded bg-elevated text-ink font-mono text-[0.85em] break-words">
            {node.value}
          </code>
        );
    }
  });
}

function renderLines(lines: InlineNode[][], key: string): React.ReactNode[] {
  return lines.flatMap((line, index) => {
    const content = renderInline(line, `${key}-${index}`);
    return index === 0 ? content : [<br key={`${key}-br-${index}`} />, ...content];
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-semibold text-ink pt-2",
  2: "text-base font-semibold text-ink pt-2",
  3: "text-sm font-semibold text-ink pt-2",
  4: "text-sm font-semibold text-ink pt-1",
};

function renderBlock(block: BlockNode, index: number): React.ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case "heading": {
      const Tag = (["h3", "h3", "h4", "h5"] as const)[block.level - 1];
      return (
        <Tag key={key} className={HEADING_CLASS[block.level]}>
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="break-words">
          {renderLines(block.lines, key)}
        </p>
      );
    case "quote":
      return (
        <blockquote key={key} className="border-s-2 border-line ps-3 text-ink-2">
          {renderLines(block.lines, key)}
        </blockquote>
      );
    case "rule":
      return <hr key={key} className="border-line" />;
    case "code":
      return (
        <pre key={key} className="p-3 rounded-control bg-canvas border border-line overflow-x-auto text-xs leading-relaxed">
          <code className="font-mono text-ink">{block.value}</code>
        </pre>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={key}
          start={block.ordered && block.start !== 1 ? block.start : undefined}
          className={`${block.ordered ? "list-decimal" : "list-disc"} ps-5 space-y-1 marker:text-ink-3`}
        >
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`} style={item.depth ? { marginInlineStart: `${item.depth * 1}rem` } : undefined}>
              {renderInline(item.children, `${key}-${itemIndex}`)}
            </li>
          ))}
        </ListTag>
      );
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-control border border-line">
          <table className="min-w-full text-xs">
            <thead className="bg-surface">
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    scope="col"
                    className="px-3 py-2 font-semibold text-ink border-b border-line"
                    style={{ textAlign: block.align[cellIndex] || "start" }}
                  >
                    {renderInline(cell, `${key}-h${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-line">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-ink-2" style={{ textAlign: block.align[cellIndex] || "start" }}>
                      {renderInline(cell, `${key}-r${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  // Parsed once per message text, not on every keystroke elsewhere on the page.
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return <div className={className ?? "space-y-2 text-sm leading-relaxed text-start"}>{blocks.map(renderBlock)}</div>;
}

export default Markdown;
