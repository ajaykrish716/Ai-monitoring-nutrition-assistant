/**
 * ChatMessageFormatter — Clean, robust rich text & markdown formatter.
 *
 * Eliminates ugly special character artifacts:
 * - Strips literal escaped quotes (\", \') and raw backslashes
 * - Strips raw JSON wraps or markdown codeblock wrappers
 * - Parses headers (###, ##, #) with clear hierarchy
 * - Parses **bold** and *italic* cleanly
 * - Formats bullet lists (-, *, •) with elegant custom bullet dots
 * - Formats numbered lists (1., 2.) with styled number badges
 * - Highlights nutritional callout blocks
 */

import React from "react";

/**
 * Format inline markdown: bold, italic, and code.
 */
function renderInlineText(text) {
  if (!text) return null;

  // Split by inline markdown tokens: bold **...**, code `...`, italic *...*
  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    const matchedText = match[0];
    if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
      tokens.push(
        <strong
          key={`b-${match.index}`}
          className="font-bold text-gray-900 dark:text-white"
        >
          {matchedText.slice(2, -2)}
        </strong>
      );
    } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
      tokens.push(
        <code
          key={`c-${match.index}`}
          className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-primary-700 dark:text-primary-300 font-mono text-[11px] sm:text-xs"
        >
          {matchedText.slice(1, -1)}
        </code>
      );
    } else if (matchedText.startsWith("*") && matchedText.endsWith("*")) {
      tokens.push(
        <em
          key={`i-${match.index}`}
          className="italic text-gray-700 dark:text-slate-300"
        >
          {matchedText.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}

export default function ChatMessageFormatter({ content, className = "" }) {
  if (!content) return null;

  // 1. Sanitize raw text artifacts
  let clean = String(content)
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  // If text was wrapped in a JSON block like {"message": "..."}
  if (clean.trim().startsWith("{") && clean.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(clean.trim());
      if (parsed.message) {
        clean = parsed.message;
      }
    } catch (e) {
      // not JSON, keep clean
    }
  }

  // Strip wrapping markdown code blocks if the whole response is enclosed in ```
  clean = clean.replace(/^```(?:markdown|text|json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // 2. Break into logical blocks (paragraphs, lists, headings)
  const lines = clean.split("\n");
  const blocks = [];
  let currentList = null;

  lines.forEach((rawLine, lineIdx) => {
    const line = rawLine.trim();

    if (!line) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      return;
    }

    // Check for Headings: ###, ##, #
    if (line.startsWith("### ")) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      blocks.push({
        type: "h3",
        text: line.replace(/^###\s+/, ""),
        key: `h3-${lineIdx}`,
      });
      return;
    }

    if (line.startsWith("## ")) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      blocks.push({
        type: "h2",
        text: line.replace(/^##\s+/, ""),
        key: `h2-${lineIdx}`,
      });
      return;
    }

    if (line.startsWith("# ")) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      blocks.push({
        type: "h1",
        text: line.replace(/^#\s+/, ""),
        key: `h1-${lineIdx}`,
      });
      return;
    }

    // Check for Bullet points: -, *, •
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      if (!currentList || currentList.listType !== "bullet") {
        if (currentList) blocks.push(currentList);
        currentList = {
          type: "list",
          listType: "bullet",
          items: [],
          key: `list-ul-${lineIdx}`,
        };
      }
      currentList.items.push(bulletMatch[1]);
      return;
    }

    // Check for Numbered points: 1. , 2.
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      if (!currentList || currentList.listType !== "ordered") {
        if (currentList) blocks.push(currentList);
        currentList = {
          type: "list",
          listType: "ordered",
          items: [],
          key: `list-ol-${lineIdx}`,
        };
      }
      currentList.items.push({ num: numMatch[1], text: numMatch[2] });
      return;
    }

    // Check for Callout / Quote block: > text
    if (line.startsWith("> ")) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      blocks.push({
        type: "quote",
        text: line.replace(/^>\s+/, ""),
        key: `quote-${lineIdx}`,
      });
      return;
    }

    // Regular paragraph line
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    blocks.push({
      type: "p",
      text: line,
      key: `p-${lineIdx}`,
    });
  });

  if (currentList) {
    blocks.push(currentList);
  }

  return (
    <div className={`space-y-2.5 text-xs sm:text-sm leading-relaxed ${className}`}>
      {blocks.map((block) => {
        switch (block.type) {
          case "h1":
            return (
              <h4
                key={block.key}
                className="text-base sm:text-lg font-black tracking-tight text-gray-900 dark:text-white mt-3 pt-1"
              >
                {renderInlineText(block.text)}
              </h4>
            );

          case "h2":
            return (
              <h5
                key={block.key}
                className="text-sm sm:text-base font-bold tracking-tight text-gray-900 dark:text-white mt-2.5"
              >
                {renderInlineText(block.text)}
              </h5>
            );

          case "h3":
            return (
              <h6
                key={block.key}
                className="text-xs sm:text-sm font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider mt-2"
              >
                {renderInlineText(block.text)}
              </h6>
            );

          case "quote":
            return (
              <div
                key={block.key}
                className="p-3 my-2 rounded-2xl bg-primary-50/70 dark:bg-primary-950/40 border-l-4 border-primary-500 dark:border-primary-400 text-xs sm:text-sm text-gray-700 dark:text-slate-300 font-medium"
              >
                {renderInlineText(block.text)}
              </div>
            );

          case "list":
            if (block.listType === "ordered") {
              return (
                <ol key={block.key} className="space-y-1.5 my-1.5 pl-1">
                  {block.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold text-[10px] shrink-0 mt-0.5">
                        {item.num}
                      </span>
                      <span className="flex-1 text-gray-800 dark:text-slate-200">
                        {renderInlineText(item.text)}
                      </span>
                    </li>
                  ))}
                </ol>
              );
            }

            return (
              <ul key={block.key} className="space-y-1.5 my-1.5 pl-1">
                {block.items.map((itemText, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400 shrink-0 mt-2" />
                    <span className="flex-1 text-gray-800 dark:text-slate-200">
                      {renderInlineText(itemText)}
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "p":
          default:
            return (
              <p key={block.key} className="text-gray-800 dark:text-slate-200">
                {renderInlineText(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
