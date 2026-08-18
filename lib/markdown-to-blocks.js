// Shared markdown -> Notion block converter, used by both server/index.js
// and cli/notion-cli.js so they don't drift into two different converters
// with two different sets of supported markdown (headers/code/lists/bold).

// Notion rejects any rich_text.text.content longer than this outright, so a
// single long paragraph or code block must be split into consecutive text
// runs rather than sent as one oversized string.
const MAX_TEXT_LENGTH = 2000;

function chunkText(content, annotations) {
  const pieces = [];
  for (let i = 0; i < content.length || i === 0; i += MAX_TEXT_LENGTH) {
    const piece = content.slice(i, i + MAX_TEXT_LENGTH);
    pieces.push(
      annotations
        ? { type: 'text', text: { content: piece }, annotations }
        : { type: 'text', text: { content: piece } },
    );
  }
  return pieces;
}

export function markdownToNotionBlocks(markdownText) {
  if (!markdownText) return [];
  const lines = markdownText.split('\n');
  const blocks = [];
  let inCodeBlock = false;
  let codeContent = [];
  let codeLanguage = 'javascript';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle Code Blocks ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: chunkText(codeContent.join('\n')),
            language: codeLanguage || 'plain text',
          },
        });
        inCodeBlock = false;
        codeContent = [];
      } else {
        inCodeBlock = true;
        codeLanguage = line.trim().replace(/^```/, '').trim() || 'plain text';
        // map common language names to notion supported
        const langMap = {
          js: 'javascript',
          ts: 'typescript',
          py: 'python',
          sh: 'bash',
          bash: 'bash',
          json: 'json',
          html: 'html',
          css: 'css',
        };
        codeLanguage = langMap[codeLanguage.toLowerCase()] || codeLanguage || 'plain text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings. Notion only has 3 heading levels - a level-4+ markdown heading
    // becomes a bold paragraph rather than being silently downgraded to
    // heading_3, since it isn't a real (collapsible/TOC-indexed) heading there.
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: parseRichText(content) },
        });
      } else if (level === 2) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: parseRichText(content) },
        });
      } else if (level === 3) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: parseRichText(content) },
        });
      } else {
        const rich = parseRichText(content).map((rt) => ({
          ...rt,
          annotations: { ...(rt.annotations || {}), bold: true },
        }));
        blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rich } });
      }
    }
    // Image (block-level: the whole line is exactly one ![alt](url) - inline
    // images mixed into a text line fall through to the paragraph case below
    // and render as literal text, same as unsupported syntax elsewhere here).
    // The url must already be a real reachable URL (e.g. uploaded to R2) -
    // this converter doesn't fetch/host local file paths itself.
    else if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      const url = trimmed.match(/^!\[[^\]]*\]\(([^)]+)\)$/)[1];
      blocks.push({
        object: 'block',
        type: 'image',
        image: { type: 'external', external: { url } },
      });
    }
    // Checkboxes / To-do
    else if (trimmed.match(/^[-*]\s*\[([ xX])\]\s+(.*)/)) {
      const match = trimmed.match(/^[-*]\s*\[([ xX])\]\s+(.*)/);
      const checked = match[1].toLowerCase() === 'x';
      const content = match[2];
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: parseRichText(content),
          checked: checked,
        },
      });
    }
    // Bullet list
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseRichText(trimmed.substring(2)) },
      });
    }
    // Numbered list
    else if (trimmed.match(/^\d+\.\s+(.*)/)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseRichText(content) },
      });
    }
    // Callout / Quote
    else if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: parseRichText(trimmed.substring(2)),
          icon: { type: 'emoji', emoji: '💡' },
        },
      });
    }
    // Horizontal rule
    else if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
    }
    // Table (GFM pipe table: header row, then a |---|---| separator row)
    else if (
      /^\|.*\|$/.test(trimmed) &&
      lines[i + 1] &&
      /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())
    ) {
      const parseRow = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
      const header = parseRow(trimmed);
      let j = i + 2;
      const dataRows = [];
      while (j < lines.length && /^\|.*\|$/.test(lines[j].trim())) {
        dataRows.push(parseRow(lines[j]));
        j++;
      }
      blocks.push({
        object: 'block',
        type: 'table',
        table: {
          table_width: header.length,
          has_column_header: true,
          has_row_header: false,
          children: [header, ...dataRows].map((cells) => ({
            object: 'block',
            type: 'table_row',
            table_row: { cells: cells.map((c) => parseRichText(c)) },
          })),
        },
      });
      i = j - 1;
    }
    // Toggle (<details><summary>Title</summary> ... </details>)
    else if (trimmed.startsWith('<details>')) {
      let j = i + 1;
      let summary = '토글';
      if (lines[j] && lines[j].trim().startsWith('<summary>')) {
        summary = lines[j]
          .trim()
          .replace(/<\/?summary>/g, '')
          .trim();
        j++;
      }
      const innerLines = [];
      while (j < lines.length && !lines[j].trim().startsWith('</details>')) {
        innerLines.push(lines[j]);
        j++;
      }
      blocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: parseRichText(summary),
          children: markdownToNotionBlocks(innerLines.join('\n')),
        },
      });
      i = j; // land on the </details> line; outer i++ moves past it
    }
    // Standard Paragraph
    else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: parseRichText(trimmed) },
      });
    }
  }

  return blocks;
}

// Simple inline markdown rich text parser for **bold**, *italic*, `code`
export function parseRichText(text) {
  if (!text) return [{ type: 'text', text: { content: '' } }];

  // Simple tokenized parsing for basic markdown styles
  const richTexts = [];
  // Standard regex to split by bold, italic, code, strikethrough, links
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);
  const linkRegex = /^\[([^\]]+)\]\(([^)]+)\)$/;

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      richTexts.push(...chunkText(part.slice(2, -2), { bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      richTexts.push(...chunkText(part.slice(1, -1), { italic: true }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      richTexts.push(...chunkText(part.slice(1, -1), { code: true }));
    } else if (part.startsWith('~~') && part.endsWith('~~')) {
      richTexts.push(...chunkText(part.slice(2, -2), { strikethrough: true }));
    } else if (linkRegex.test(part)) {
      // Link text in this converter's real-world use is always short, well
      // under the 2000-char chunk cap, so this skips chunkText's splitting -
      // a link's text/url pair should stay a single rich_text object anyway.
      const [, linkText, url] = part.match(linkRegex);
      richTexts.push({ type: 'text', text: { content: linkText, link: { url } } });
    } else {
      richTexts.push(...chunkText(part));
    }
  }

  return richTexts.length > 0 ? richTexts : chunkText(text);
}
