// Shared markdown -> Notion block converter, used by both server/index.js
// and cli/notion-cli.js so they don't drift into two different converters
// with two different sets of supported markdown (headers/code/lists/bold).

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
            rich_text: [{ type: 'text', text: { content: codeContent.join('\n') } }],
            language: codeLanguage || 'plain text',
          },
        });
        inCodeBlock = false;
        codeContent = [];
      } else {
        inCodeBlock = true;
        codeLanguage = line.trim().replace(/^```/, '').trim() || 'plain text';
        // map common language names to notion supported
        const langMap = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', bash: 'bash', json: 'json', html: 'html', css: 'css' };
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

    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: parseRichText(trimmed.substring(2)) }
      });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: parseRichText(trimmed.substring(3)) }
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: parseRichText(trimmed.substring(4)) }
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
          checked: checked
        }
      });
    }
    // Bullet list
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseRichText(trimmed.substring(2)) }
      });
    }
    // Numbered list
    else if (trimmed.match(/^\d+\.\s+(.*)/)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseRichText(content) }
      });
    }
    // Callout / Quote
    else if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: parseRichText(trimmed.substring(2)),
          icon: { type: 'emoji', emoji: '💡' }
        }
      });
    }
    // Standard Paragraph
    else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: parseRichText(trimmed) }
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
  // Standard regex to split by bold, italic, code
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      richTexts.push({
        type: 'text',
        text: { content: part.slice(2, -2) },
        annotations: { bold: true }
      });
    } else if (part.startsWith('*') && part.endsWith('*')) {
      richTexts.push({
        type: 'text',
        text: { content: part.slice(1, -1) },
        annotations: { italic: true }
      });
    } else if (part.startsWith('`') && part.endsWith('`')) {
      richTexts.push({
        type: 'text',
        text: { content: part.slice(1, -1) },
        annotations: { code: true }
      });
    } else {
      richTexts.push({
        type: 'text',
        text: { content: part }
      });
    }
  }

  return richTexts.length > 0 ? richTexts : [{ type: 'text', text: { content: text } }];
}
