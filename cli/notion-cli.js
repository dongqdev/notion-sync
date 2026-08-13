#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client, collectPaginatedAPI } from '@notionhq/client';
import { markdownToNotionBlocks as markdownToBlocks } from '../lib/markdown-to-blocks.js';
import { createWorker } from 'tesseract.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const TRASH_PAGE_ID = process.env.NOTION_TRASH_PAGE_ID || '3b9813eb-7677-8101-a4c1-d67d707c9506';
const RESTORE_REF_PREFIX = '[ref:';

function getPageTitle(page) {
  if (page.object === 'page') {
    const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
    if (titleProp && titleProp.title.length > 0) {
      return titleProp.title.map(t => t.plain_text).join('');
    }
  } else if (page.object === 'database') {
    return page.title ? page.title.map(t => t.plain_text).join('') : '';
  }
  return '(제목 없음)';
}

async function listAllBlocks(blockId) {
  return collectPaginatedAPI(notion.blocks.children.list, { block_id: blockId, page_size: 100 });
}

// Notion caps children arrays at 100 blocks per request, so anything longer
// must be appended in batches or it silently fails/truncates.
async function appendBlocksInBatches(blockId, blocks) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({ block_id: blockId, children: blocks.slice(i, i + 100) });
  }
}

async function findPageByTitle(query) {
  const res = await notion.search({
    query: query,
    page_size: 10
  });

  if (!res.results || res.results.length === 0) {
    throw new Error(`Page matching "${query}" not found.`);
  }

  const match = res.results.find(item =>
    getPageTitle(item).toLowerCase().includes(query.toLowerCase())
  ) || res.results[0];

  return match;
}

// Like findPageByTitle, but for destructive commands: refuses to silently fall
// back to the top search hit when nothing actually matches the title, since a
// wrong guess here means archiving the wrong page.
async function findPageByTitleExact(query) {
  const res = await notion.search({ query, page_size: 10 });
  if (!res.results || res.results.length === 0) {
    throw new Error(`Page matching "${query}" not found.`);
  }
  const match = res.results.find(item =>
    getPageTitle(item).toLowerCase().includes(query.toLowerCase())
  );
  if (!match) {
    throw new Error(
      `No page title actually contains "${query}" (closest search hit: "${getPageTitle(res.results[0])}"). ` +
      `Refusing to guess on a destructive command — run "search" first and pass the exact title.`
    );
  }
  return match;
}

function blockText(block) {
  const data = block[block.type];
  if (data && data.rich_text) {
    return data.rich_text.map(t => t.plain_text).join('');
  }
  return '';
}

function blocksToMarkdown(blocks) {
  return blocks.map(b => {
    const text = blockText(b);
    if (b.type === 'heading_1') return `# ${text}`;
    if (b.type === 'heading_2') return `## ${text}`;
    if (b.type === 'heading_3') return `### ${text}`;
    if (b.type === 'bulleted_list_item') return `- ${text}`;
    if (b.type === 'numbered_list_item') return `1. ${text}`;
    if (b.type === 'to_do') return `- [${b.to_do?.checked ? 'x' : ' '}] ${text}`;
    if (b.type === 'callout') return `> ${text}`;
    if (b.type === 'quote') return `> ${text}`;
    if (b.type === 'code') return `\`\`\`\n${text}\n\`\`\``;
    return text;
  }).filter(Boolean).join('\n\n');
}

// Recursively drops null-valued keys: Notion's read API fills in fields like
// `icon: null` or `color: null` on block payloads, but its write validation
// rejects those same fields unless they're omitted entirely or a real object.
function dropNulls(value) {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== null) out[k] = dropNulls(v);
    }
    return out;
  }
  return value;
}

// Strips read-only fields (id, timestamps, has_children...) so a fetched block
// can be reused as a "block create" object in another page's `children`.
function sanitizeBlockForCreate(block) {
  return { object: 'block', type: block.type, [block.type]: dropNulls(block[block.type]) };
}

// Only catches structured, regex-shaped info (email/phone/IP/URL/secret-looking
// key=value pairs). Freeform stuff like a person's name or a client/project name
// isn't regex-matchable — the calling agent has to catch those by actually
// reading the text, this is just a starting checklist.
const SCAN_PATTERNS = [
  { type: '이메일', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { type: '전화번호', re: /\b(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|0[2-9]\d?[-.\s]?\d{3,4}[-.\s]?\d{4})\b/g },
  { type: 'IP주소', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: '접속정보/키', re: /\b(api[_-]?key|access[_-]?key|secret|token|password|pwd)\b\s*[:=]\s*\S+/gi },
  { type: 'URL', re: /https?:\/\/[^\s)]+/g }
];

function scanText(text) {
  const findings = [];
  for (const { type, re } of SCAN_PATTERNS) {
    for (const match of text.match(re) || []) {
      findings.push({ type, match });
    }
  }
  return findings;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Notion Agent CLI Usage:
  node cli/notion-cli.js search <query>
  node cli/notion-cli.js get-content <page_query>
  node cli/notion-cli.js create <parent_page_query> <title> <content_markdown>
  node cli/notion-cli.js add-toggle <page_query> <toggle_title> <content_markdown>
  node cli/notion-cli.js append <page_query> <content_markdown>
  node cli/notion-cli.js propose-edit <page_query> <revised_markdown>
  node cli/notion-cli.js approve-edit <page_query>
  node cli/notion-cli.js delete <page_query>
  node cli/notion-cli.js list-trash
  node cli/notion-cli.js restore <trash_entry_query>
  node cli/notion-cli.js scan <page_query>
  node cli/notion-cli.js scan-images <page_query>
    `);
    process.exit(0);
  }

  try {
    if (command === 'search') {
      const query = args[1] || '';
      const res = await notion.search({ query, page_size: 20 });
      console.log(JSON.stringify(res.results.map(r => ({ id: r.id, object: r.object, title: getPageTitle(r), url: r.url })), null, 2));
    } else if (command === 'get-content') {
      const pageQuery = args[1];
      const targetPage = await findPageByTitle(pageQuery);

      const blocks = await listAllBlocks(targetPage.id);
      const markdown = blocksToMarkdown(blocks);

      console.log(`# ${getPageTitle(targetPage)} (${targetPage.id})\n\n${markdown}`);
    } else if (command === 'create') {
      const parentQuery = args[1];
      const title = args[2];
      const markdownContent = args[3] || '';

      if (!parentQuery || !title) {
        throw new Error('Usage: create <parent_page_query> <title> <content_markdown>');
      }

      const parentPage = await findPageByTitle(parentQuery);
      const isDatabase = parentPage.object === 'database';
      const contentBlocks = markdownToBlocks(markdownContent);
      const newPage = await notion.pages.create({
        parent: isDatabase ? { database_id: parentPage.id } : { page_id: parentPage.id },
        properties: {
          // Databases conventionally name their title property "Name"; plain pages always use "title".
          [isDatabase ? 'Name' : 'title']: { title: [{ type: 'text', text: { content: title } }] }
        },
        children: contentBlocks.slice(0, 100)
      });
      if (contentBlocks.length > 100) {
        await appendBlocksInBatches(newPage.id, contentBlocks.slice(100));
      }

      console.log(`SUCCESS: Created "${title}" under "${parentQuery}" (${newPage.url})`);
    } else if (command === 'add-toggle') {
      const pageQuery = args[1];
      const toggleTitle = args[2];
      const markdownContent = args[3] || '';

      const targetPage = await findPageByTitle(pageQuery);

      const toggleBlock = {
        children: [
          {
            object: 'block',
            type: 'toggle',
            toggle: {
              rich_text: [{ type: 'text', text: { content: toggleTitle }, annotations: { bold: true } }],
              children: markdownToBlocks(markdownContent)
            }
          }
        ]
      };

      await notion.blocks.children.append({
        block_id: targetPage.id,
        children: toggleBlock.children
      });

      console.log(`SUCCESS: Added toggle "${toggleTitle}" under "${pageQuery}" (${targetPage.id})`);
    } else if (command === 'propose-edit') {
      const pageQuery = args[1];
      const revisedMarkdown = args[2] || '';
      const targetPage = await findPageByTitle(pageQuery);

      const bannerBlock = {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: '✨ [AI 수정 제안본] 아래 내용은 AI가 새로 다듬은 수정본입니다. 기존 원문은 상단에 보존되어 있으며, 최종 반영하시려면 대화창에 "OK" 또는 "수정 승인"이라고 말씀해주세요.' } }],
          icon: { type: 'emoji', emoji: '📝' }
        }
      };

      const revisedBlocks = [bannerBlock, ...markdownToBlocks(revisedMarkdown)];
      await appendBlocksInBatches(targetPage.id, revisedBlocks);

      console.log(`PROPOSED_EDIT_SUCCESS: Appended proposed revision to "${pageQuery}" (${targetPage.id})`);
    } else if (command === 'approve-edit') {
      const pageQuery = args[1];
      const targetPage = await findPageByTitle(pageQuery);

      // Fetch all page blocks (paginated, so long articles aren't silently truncated)
      const blocks = await listAllBlocks(targetPage.id);

      // Find banner index
      const bannerIndex = blocks.findIndex(b =>
        b.type === 'callout' &&
        b.callout?.rich_text?.[0]?.plain_text?.includes('[AI 수정 제안본]')
      );

      if (bannerIndex === -1) {
        console.log(`NO_PROPOSAL_FOUND: No pending AI proposal banner found on "${pageQuery}".`);
        return;
      }

      // Old blocks are before bannerIndex
      const oldBlocks = blocks.slice(0, bannerIndex);
      const dateStr = new Date().toISOString().split('T')[0];

      // Backup old blocks to Trash page (content is copied in, not just a marker page).
      // Long articles can exceed Notion's 100-block-per-request cap, so the
      // first 100 go in at create time and the rest are appended after -
      // otherwise a long original would fail to back up before being deleted below.
      const sanitizedOldBlocks = oldBlocks.map(sanitizeBlockForCreate);
      const backupPage = await notion.pages.create({
        parent: { page_id: TRASH_PAGE_ID },
        icon: { type: 'emoji', emoji: '📦' },
        properties: {
          title: { title: [{ type: 'text', text: { content: `[백업 원문] ${pageQuery} (${dateStr})` } }] }
        },
        children: sanitizedOldBlocks.slice(0, 100)
      });
      if (sanitizedOldBlocks.length > 100) {
        await appendBlocksInBatches(backupPage.id, sanitizedOldBlocks.slice(100));
      }

      // Delete old blocks and banner block from target page
      for (let i = 0; i <= bannerIndex; i++) {
        try {
          await notion.blocks.delete({ block_id: blocks[i].id });
        } catch (e) {
          // ignore already deleted or system blocks
        }
      }

      console.log(`APPROVED_EDIT_SUCCESS: Moved original content to Trash Page (${backupPage.url}) and updated "${pageQuery}".`);
    } else if (command === 'append') {
      const pageQuery = args[1];
      const markdownContent = args[2] || '';
      const targetPage = await findPageByTitle(pageQuery);

      const children = markdownToBlocks(markdownContent);
      await appendBlocksInBatches(targetPage.id, children);

      console.log(`SUCCESS: Appended content to "${pageQuery}"`);
    } else if (command === 'delete') {
      const pageQuery = args[1];
      const targetPage = await findPageByTitleExact(pageQuery);
      const title = getPageTitle(targetPage);
      const dateStr = new Date().toISOString().split('T')[0];

      // Notion's public API cannot permanently delete a page, only archive it.
      // So "delete" here means: archive the original (recoverable from Notion's
      // own trash for 30 days) AND leave a findable, human-readable pointer to it
      // under the workspace's own Trash Archive page, since an archived page drops
      // out of normal search results and is otherwise hard to locate again.
      const trashEntry = await notion.pages.create({
        parent: { page_id: TRASH_PAGE_ID },
        icon: { type: 'emoji', emoji: '🗑️' },
        properties: {
          title: { title: [{ type: 'text', text: { content: `🗑️ ${title} (${dateStr})` } }] }
        },
        children: [
          {
            object: 'block',
            type: 'bookmark',
            bookmark: { url: targetPage.url }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: `${RESTORE_REF_PREFIX}${targetPage.id}]` } }]
            }
          }
        ]
      });

      await notion.pages.update({ page_id: targetPage.id, archived: true });

      console.log(`DELETE_SUCCESS: Archived "${title}" and recorded it in Trash Archive (${trashEntry.url}).`);
    } else if (command === 'list-trash') {
      const blocks = await listAllBlocks(TRASH_PAGE_ID);
      const entries = blocks
        .filter(b => b.type === 'child_page')
        .map(b => ({ id: b.id, title: b.child_page.title, created_time: b.created_time }))
        .sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

      console.log(JSON.stringify(entries, null, 2));
    } else if (command === 'restore') {
      const trashQuery = args[1];
      const entry = await findPageByTitle(trashQuery);

      const blocks = await listAllBlocks(entry.id);
      const refBlock = blocks.find(b =>
        b.type === 'paragraph' && blockText(b).startsWith(RESTORE_REF_PREFIX)
      );

      if (!refBlock) {
        console.log(`NO_REF_FOUND: "${trashQuery}" doesn't look like a trash entry created by "delete" (no original-page reference found).`);
        return;
      }

      const originalId = blockText(refBlock).slice(RESTORE_REF_PREFIX.length, -1);
      await notion.pages.update({ page_id: originalId, archived: false });
      const restoredPage = await notion.pages.retrieve({ page_id: originalId });

      console.log(`RESTORE_SUCCESS: Restored ${restoredPage.url}`);
    } else if (command === 'scan') {
      const pageQuery = args[1];
      const targetPage = await findPageByTitle(pageQuery);
      const blocks = await listAllBlocks(targetPage.id);
      const markdown = blocksToMarkdown(blocks);

      console.log(JSON.stringify({
        page: getPageTitle(targetPage),
        note: '정규식으로 잡히는 패턴만 감지합니다(이메일/전화번호/IP/접속키워드/URL). 담당자 이름, 거래처·프로젝트명처럼 정형화되지 않은 정보는 여기 없어도 본문을 직접 읽고 판단해서 같이 가려야 합니다.',
        findings: scanText(markdown)
      }, null, 2));
    } else if (command === 'scan-images') {
      const pageQuery = args[1];
      const targetPage = await findPageByTitle(pageQuery);
      const blocks = await listAllBlocks(targetPage.id);
      const imageBlocks = blocks.filter(b => b.type === 'image');

      if (imageBlocks.length === 0) {
        console.log(JSON.stringify({ page: getPageTitle(targetPage), images: [] }, null, 2));
        return;
      }

      const worker = await createWorker('eng+kor');
      const images = [];
      for (const block of imageBlocks) {
        const url = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
        try {
          const { data } = await worker.recognize(url);
          const text = (data.text || '').trim();
          images.push({ blockId: block.id, imageUrl: url, hasText: text.length > 0, extractedText: text });
        } catch (e) {
          images.push({ blockId: block.id, imageUrl: url, error: e.message });
        }
      }
      await worker.terminate();

      console.log(JSON.stringify({
        page: getPageTitle(targetPage),
        note: '이미지에서 OCR로 인식된 텍스트만 보여줍니다. 실제로 가릴지 여부는 에이전트/사용자 판단이며, 이미지 자체를 자동으로 검게 칠하거나 재업로드하지는 않습니다.',
        images
      }, null, 2));
    }
  } catch (error) {
    console.error('CLI Error:', error.message);
    process.exit(1);
  }
}

main();
