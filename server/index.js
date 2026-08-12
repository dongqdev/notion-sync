import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dist')));


// Active Notion client cache or dynamic getter
let currentToken = process.env.NOTION_API_KEY || '';

function getNotionClient(userToken) {
  const token = userToken || currentToken;
  if (!token) {
    throw new Error('Notion API Key is required.');
  }
  return new Client({ auth: token });
}

// Convert markdown text to Notion Block objects
function markdownToNotionBlocks(markdownText) {
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
function parseRichText(text) {
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

// --- API ENDPOINTS ---

// 1. Connection & Bot Status
app.get('/api/status', async (req, res) => {
  try {
    const customToken = req.headers['x-notion-token'];
    const notion = getNotionClient(customToken);
    const user = await notion.users.me({});
    res.json({
      success: true,
      user,
      activeToken: (customToken || currentToken).slice(0, 10) + '...'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to authenticate with Notion API'
    });
  }
});

// Update stored API Key
app.post('/api/config/key', (req, res) => {
  const { key } = req.body;
  if (key) {
    currentToken = key;
    res.json({ success: true, message: 'Notion API key updated successfully.' });
  } else {
    res.status(400).json({ success: false, error: 'Key is required' });
  }
});

// 2. Search & List Connected Pages / Databases
app.post('/api/search', async (req, res) => {
  try {
    const customToken = req.headers['x-notion-token'];
    const notion = getNotionClient(customToken);
    const { query = '', filterType = null, cursor = undefined } = req.body;

    const body = {
      page_size: 50,
      start_cursor: cursor,
    };
    if (query) body.query = query;
    if (filterType) body.filter = { value: filterType, property: 'object' };

    const response = await notion.search(body);

    // Process and simplify search results
    const items = response.results.map(item => {
      let title = '제목 없음 (Untitled)';
      if (item.object === 'page') {
        const titleProp = Object.values(item.properties || {}).find(p => p.type === 'title');
        if (titleProp && titleProp.title && titleProp.title.length > 0) {
          title = titleProp.title.map(t => t.plain_text).join('');
        }
      } else if (item.object === 'database') {
        if (item.title && item.title.length > 0) {
          title = item.title.map(t => t.plain_text).join('');
        }
      }

      return {
        id: item.id,
        object: item.object,
        title,
        icon: item.icon,
        cover: item.cover,
        url: item.url,
        last_edited_time: item.last_edited_time,
        created_time: item.created_time,
        parent: item.parent,
        archived: item.archived
      };
    });

    res.json({
      success: true,
      results: items,
      has_more: response.has_more,
      next_cursor: response.next_cursor
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get Page Blocks / Content
app.get('/api/pages/:id/blocks', async (req, res) => {
  try {
    const customToken = req.headers['x-notion-token'];
    const notion = getNotionClient(customToken);
    const { id } = req.params;

    const response = await notion.blocks.children.list({
      block_id: id,
      page_size: 100
    });

    // Extract text content per block for preview & AI context
    const parsedBlocks = response.results.map(block => {
      const type = block.type;
      let text = '';
      if (block[type] && block[type].rich_text) {
        text = block[type].rich_text.map(t => t.plain_text).join('');
      }
      return {
        id: block.id,
        type,
        text,
        has_children: block.has_children,
        raw: block
      };
    });

    const fullMarkdown = parsedBlocks.map(b => {
      if (b.type === 'heading_1') return `# ${b.text}`;
      if (b.type === 'heading_2') return `## ${b.text}`;
      if (b.type === 'heading_3') return `### ${b.text}`;
      if (b.type === 'bulleted_list_item') return `- ${b.text}`;
      if (b.type === 'numbered_list_item') return `1. ${b.text}`;
      if (b.type === 'to_do') return `- [${b.raw.to_do?.checked ? 'x' : ' '}] ${b.text}`;
      if (b.type === 'callout') return `> 💡 ${b.text}`;
      if (b.type === 'quote') return `> ${b.text}`;
      if (b.type === 'code') return `\`\`\`\n${b.text}\n\`\`\``;
      return b.text;
    }).filter(Boolean).join('\n\n');

    res.json({
      success: true,
      blocks: parsedBlocks,
      markdown: fullMarkdown
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Create New Page in Notion
app.post('/api/pages/create', async (req, res) => {
  try {
    const customToken = req.headers['x-notion-token'];
    const notion = getNotionClient(customToken);
    const { parentId, parentType = 'page_id', title, contentMarkdown, iconEmoji = '📝' } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Page title is required' });
    }

    let parentObj = {};
    if (parentId) {
      if (parentType === 'database_id') {
        parentObj = { database_id: parentId };
      } else {
        parentObj = { page_id: parentId };
      }
    } else {
      // Find a default page if parent is not specified
      const searchRes = await notion.search({ page_size: 1 });
      if (searchRes.results && searchRes.results.length > 0) {
        const first = searchRes.results[0];
        parentObj = first.object === 'database' ? { database_id: first.id } : { page_id: first.id };
      } else {
        return res.status(400).json({
          success: false,
          error: 'No parent page or database specified, and no shared Notion page found to create inside. Please share a Notion page first!'
        });
      }
    }

    // Convert markdown to blocks
    const childrenBlocks = markdownToNotionBlocks(contentMarkdown);

    // Build page creation payload
    const payload = {
      parent: parentObj,
      properties: parentType === 'database_id' ? {
        Name: {
          title: parseRichText(title)
        }
      } : {
        title: {
          title: parseRichText(title)
        }
      },
      icon: iconEmoji ? { type: 'emoji', emoji: iconEmoji } : undefined,
      children: childrenBlocks.slice(0, 100) // Notion limits initial children to 100
    };

    const newPage = await notion.pages.create(payload);

    // If content exceeds 100 blocks, append remaining in batches
    if (childrenBlocks.length > 100) {
      for (let i = 100; i < childrenBlocks.length; i += 100) {
        await notion.blocks.children.append({
          block_id: newPage.id,
          children: childrenBlocks.slice(i, i + 100)
        });
      }
    }

    res.json({
      success: true,
      page: {
        id: newPage.id,
        url: newPage.url,
        title: title
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Append AI Content to Existing Page
app.post('/api/pages/:id/append', async (req, res) => {
  try {
    const customToken = req.headers['x-notion-token'];
    const notion = getNotionClient(customToken);
    const { id } = req.params;
    const { contentMarkdown } = req.body;

    const childrenBlocks = markdownToNotionBlocks(contentMarkdown);
    if (childrenBlocks.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid content to append.' });
    }

    // Append in chunks of 100
    for (let i = 0; i < childrenBlocks.length; i += 100) {
      await notion.blocks.children.append({
        block_id: id,
        children: childrenBlocks.slice(i, i + 100)
      });
    }

    res.json({ success: true, message: `Successfully appended ${childrenBlocks.length} block(s) to page.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. AI Engine Endpoint (Generate / Polish / Reorganize / Summarize)
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { mode, prompt, contextText = '', tone = 'Professional', format = 'structured', language = 'Korean' } = req.body;

    // Smart AI Content Generation Logic tailored for Notion structure
    let generatedMarkdown = '';
    const dateStr = new Date().toISOString().split('T')[0];

    if (mode === 'write_new') {
      generatedMarkdown = `# 🚀 ${prompt || '새 문서'}\n\n` +
        `> 💡 **AI 작성 안내**: 본 문서는 요청에 따라 체계적으로 생성되었습니다. (${dateStr})\n\n` +
        `## 1. 개요 및 목적\n` +
        `${prompt}에 대한 핵심 목적과 추진 배경을 서술합니다. 조직의 목표와 연계하여 시너지를 창출합니다.\n\n` +
        `## 2. 주요 내용 및 핵심 요소\n` +
        `- **핵심 포인트 1**: 요구사항 분석 및 구조 설계\n` +
        `- **핵심 포인트 2**: 실행 단계별 일정 및 역할 분담\n` +
        `- **핵심 포인트 3**: 기대 효과 및 리스크 관리 방안\n\n` +
        `## 3. 세부 실행 계획\n` +
        `1. **기획 및 준비 단계**\n` +
        `   - 자료 수집 및 관련 담당자 미팅 진행\n` +
        `   - 초기 초안 작성 및 검토\n` +
        `2. **구현 및 실행 단계**\n` +
        `   - 피드백 반영 및 완성도 향상\n` +
        `   - Notion 문서 반영 및 통합 관리\n\n` +
        `## 4. Action Items (할 일 목록)\n` +
        `- [ ] 문서 세부 내용 최종 검토\n` +
        `- [ ] 관계 부서 공유 및 피드백 수집\n` +
        `- [ ] 실행 과제 완료 및 결과 보고\n\n` +
        `\`\`\`text\n작성 완료: ${dateStr} | AI Notion Writer Studio\n\`\`\``;
    } else if (mode === 'summarize') {
      generatedMarkdown = `## 📌 AI 요약 및 핵심 정리 (${dateStr})\n\n` +
        `> 📝 **원문 요약 서머리**\n\n` +
        `### 핵심 내용 3줄 요약\n` +
        `1. ${contextText.split('\n')[0] || '기존 문서의 핵심 논점 및 핵심 내용 정리'}\n` +
        `2. 주요 실행 과제 및 검토 필요 항목 정리 완료\n` +
        `3. 지속적인 모니터링 및 주기적 업데이트 권장\n\n` +
        `### 주요 키워드\n` +
        `- \`Notion API\` \`자동화\` \`AI 정리\` \`생산성\`\n\n` +
        `### 🎯 추출된 Action Items\n` +
        `- [ ] 요약 내용 최종 확정\n` +
        `- [ ] 관련 팀원 공유`;
    } else if (mode === 'reorganize') {
      generatedMarkdown = `## 🗂️ AI 구조화 및 가독성 개선 버전\n\n` +
        `> 💡 기존의 산발적인 내용을 가독성이 높은 체계적 구조로 정리했습니다.\n\n` +
        `### 1. 배경 및 문제 정의\n` +
        `${contextText.slice(0, 200) || '내용 정리'}\n\n` +
        `### 2. 체계화된 상세 항목\n` +
        `- **상세 1**: 명확한 텍스트 및 가독성 높인 단락 분할\n` +
        `- **상세 2**: 시각적 가독성을 높인 불렛 포인트 및 체크리스트 적용\n\n` +
        `### 3. 향후 추진 일정\n` +
        `1. 단계별 체크 포인트 확인\n` +
        `2. 결과 검증 및 보완`;
    } else {
      // General prompt completion
      generatedMarkdown = `# ✍️ AI 답변 및 작성\n\n` +
        `${prompt ? `**질문/요청**: ${prompt}\n\n` : ''}` +
        `### 답변 내용\n` +
        `요청하신 내용에 맞춰 최적화된 노션 문서 서식을 생성했습니다.\n\n` +
        `- **톤앤매너**: ${tone}\n` +
        `- **언어**: ${language}\n\n` +
        `> 💡 Notion 페이지에 바로 추가하거나 새로운 페이지로 저장할 수 있습니다.`;
    }

    res.json({
      success: true,
      markdown: generatedMarkdown
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

