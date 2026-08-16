#!/usr/bin/env node
// Links this repo's .agents/skills/ (the skill Antigravity and Copilot already
// read natively at project scope) into the project-scope paths Claude Code and
// Codex expect (.claude/skills, .codex/skills), so all four agents see the same
// notion-sync-specific skill. Not committed to git (Windows junctions don't
// survive a clone) — run this once after cloning, or again if it's missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(repoRoot, '.agents', 'skills');
const targets = [path.join(repoRoot, '.claude', 'skills'), path.join(repoRoot, '.codex', 'skills')];

if (!fs.existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

for (const target of targets) {
  if (fs.existsSync(target)) {
    console.log(`skip (already exists): ${target}`);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`linked: ${target} -> ${source}`);
}
