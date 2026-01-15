import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

export async function buildAttachmentCandidates(
  extractDir: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  async function walk(dir: string) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
      } else {
        if (['.md', '.html'].includes(path.extname(ent.name).toLowerCase())) {
          continue;
        }

        const rel = path.relative(extractDir, abs).split(path.sep).join('/');
        map.set(rel, abs);
      }
    }
  }

  await walk(extractDir);
  return map;
}

export function resolveRelativeAttachmentPath(
  raw: string,
  pageDir: string,
  attachmentCandidates: Map<string, string>,
): string | null {
  let mainRel = raw.replace(/^\.?\/+/, '');
  try {
    mainRel = decodeURIComponent(mainRel);
  } catch (err) {
    Logger.warn(`URI malformed for attachment path: ${mainRel}. Falling back to raw path.`, 'ImportUtils');
  }
  const fallback = path.normalize(path.join(pageDir, mainRel)).split(path.sep).join('/');

  if (attachmentCandidates.has(mainRel)) {
    return mainRel;
  }
  if (attachmentCandidates.has(fallback)) {
    return fallback;
  }
  return null;
}

export async function collectMarkdownAndHtmlFiles(
  dir: string,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(fullPath);
      } else if (
        ['.md', '.html'].includes(path.extname(ent.name).toLowerCase())
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

export function stripNotionID(fileName: string): string {
  // Handle optional separator (space or dash) + 32 alphanumeric chars at end
  const notionIdPattern = /[ -]?[a-z0-9]{32}$/i;
  return fileName.replace(notionIdPattern, '').trim();
}
