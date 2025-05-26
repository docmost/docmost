import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { jsonToText } from '../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { cleanUrlString, extractZip, FileTaskStatus } from './file.utils';
import { StorageService } from '../storage/storage.service';
import * as tmp from 'tmp-promise';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { ImportService } from './import.service';
import { promises as fs } from 'fs';
import {
  generateSlugId,
  getMimeType,
  sanitizeFileName,
} from '../../common/helpers';
import { v7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { FileTask, InsertablePage } from '@docmost/db/types/entity.types';
import {
  DOMParser,
  Node as HDNode,
  Element as HDElement,
  Window,
} from 'happy-dom';
import { markdownToHtml } from '@docmost/editor-ext';
import { getAttachmentFolderPath } from '../../core/attachment/attachment.utils';
import { AttachmentType } from '../../core/attachment/attachment.constants';
import { getProsemirrorContent } from '../../common/helpers/prosemirror/utils';
import { formatImportHtml, notionFormatter } from './import-formatter';

@Injectable()
export class FileTaskService {
  private readonly logger = new Logger(FileTaskService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly importService: ImportService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async processZIpImport(fileTaskId: string): Promise<void> {
    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', fileTaskId)
      .executeTakeFirst();

    if (!fileTask) {
      this.logger.log(`File task with ID ${fileTaskId} not found`);
      return;
    }

    const { path: tmpZipPath, cleanup: cleanupTmpFile } = await tmp.file({
      prefix: 'docmost-import',
      postfix: '.zip',
      discardDescriptor: true,
    });

    const { path: tmpExtractDir, cleanup: cleanupTmpDir } = await tmp.dir({
      prefix: 'docmost-extract-',
      unsafeCleanup: true,
    });

    const fileStream = await this.storageService.readStream(fileTask.filePath);
    await pipeline(fileStream, createWriteStream(tmpZipPath));

    await extractZip(tmpZipPath, tmpExtractDir);

    // TODO: backlinks
    try {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Processing);
      // if type == generic
      await this.processGenericImport({ extractDir: tmpExtractDir, fileTask });
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Success);
    } catch (error) {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Failed);
      console.error(error);
    } finally {
      await cleanupTmpFile();
      await cleanupTmpDir();
    }
  }

  async processGenericImport(opts: {
    extractDir: string;
    fileTask: FileTask;
  }): Promise<void> {
    const { extractDir, fileTask } = opts;

    const allFiles = await this.collectMarkdownAndHtmlFiles(extractDir);
    const attachmentCandidates =
      await this.buildAttachmentCandidates(extractDir);

    console.log('attachment count: ', attachmentCandidates.size);

    const pagesMap = new Map<
      string,
      {
        id: string;
        slugId: string;
        name: string;
        content: string;
        position?: string | null;
        parentPageId: string | null;
        fileExtension: string;
        filePath: string;
      }
    >();

    for (const absPath of allFiles) {
      const relPath = path
        .relative(extractDir, absPath)
        .split(path.sep)
        .join('/'); // normalize to forward-slashes
      const ext = path.extname(relPath).toLowerCase();
      let content = await fs.readFile(absPath, 'utf-8');

      console.log('relative path: ', relPath, ' abs path: ', absPath);

      if (ext.toLowerCase() === '.html' || ext.toLowerCase() === '.md') {
        // we want to process all inputs as markr
        if (ext === '.md') {
          content = await markdownToHtml(content);
        }

        content = await this.rewriteLocalFilesInHtml({
          html: content,
          pageRelativePath: relPath,
          extractDir,
          pageId: v7(),
          fileTask,
          attachmentCandidates,
        });
      }

      pagesMap.set(relPath, {
        id: v7(),
        slugId: generateSlugId(),
        name: path.basename(relPath, ext),
        content,
        parentPageId: null,
        fileExtension: ext,
        filePath: relPath,
      });
    }

    // parent/child linking
    pagesMap.forEach((page, filePath) => {
      const segments = filePath.split('/');
      segments.pop();
      let parentPage = null;
      while (segments.length) {
        const tryMd = segments.join('/') + '.md';
        const tryHtml = segments.join('/') + '.html';
        if (pagesMap.has(tryMd)) {
          parentPage = pagesMap.get(tryMd)!;
          break;
        }
        if (pagesMap.has(tryHtml)) {
          parentPage = pagesMap.get(tryHtml)!;
          break;
        }
        segments.pop();
      }
      if (parentPage) page.parentPageId = parentPage.id;
    });

    // generate position keys
    const siblingsMap = new Map<string | null, typeof Array.prototype>();
    pagesMap.forEach((page) => {
      const sibs = siblingsMap.get(page.parentPageId) || [];
      sibs.push(page);
      siblingsMap.set(page.parentPageId, sibs);
    });
    siblingsMap.forEach((sibs) => {
      sibs.sort((a, b) => a.name.localeCompare(b.name));
      let prevPos: string | null = null;
      for (const page of sibs) {
        page.position = generateJitteredKeyBetween(prevPos, null);
        prevPos = page.position;
      }
    });

    const filePathToPageMetaMap = new Map<
      string,
      { id: string; title: string; slugId: string }
    >();
    pagesMap.forEach((page) => {
      filePathToPageMetaMap.set(page.filePath, {
        id: page.id,
        title: page.name,
        slugId: page.slugId,
      });
    });

    const insertablePages: InsertablePage[] = await Promise.all(
      Array.from(pagesMap.values()).map(async (page) => {
        const htmlContent = await this.rewriteInternalLinksToMentionHtml(
          page.content,
          page.filePath,
          filePathToPageMetaMap,
          fileTask.creatorId,
        );

        const pmState = getProsemirrorContent(
          await this.importService.processHTML(formatImportHtml(htmlContent)),
        );

        const { title, prosemirrorJson } =
          this.importService.extractTitleAndRemoveHeading(pmState);

        return {
          id: page.id,
          slugId: page.slugId,
          title: title || page.name,
          content: prosemirrorJson,
          textContent: jsonToText(prosemirrorJson),
          ydoc: await this.importService.createYdoc(prosemirrorJson),
          position: page.position!,
          spaceId: fileTask.spaceId,
          workspaceId: fileTask.workspaceId,
          creatorId: fileTask.creatorId,
          lastUpdatedById: fileTask.creatorId,
          parentPageId: page.parentPageId,
        };
      }),
    );

    try {
      await this.db.insertInto('pages').values(insertablePages).execute();
      //todo: avoid duplicates
      // log success
      // backlinks mapping
      // handle svg diagram nodes
    } catch (e) {
      console.error(e);
    }
  }

  async rewriteLocalFilesInHtml(opts: {
    html: string;
    pageRelativePath: string;
    extractDir: string;
    pageId: string;
    fileTask: FileTask;
    attachmentCandidates: Map<string, string>;
  }): Promise<string> {
    const {
      html,
      pageRelativePath,
      extractDir,
      pageId,
      fileTask,
      attachmentCandidates,
    } = opts;

    const window = new Window();
    const doc = window.document;
    doc.body.innerHTML = html;

    const tasks: Promise<void>[] = [];

    const processFile = (relPath: string) => {
      const abs = attachmentCandidates.get(relPath)!;
      const attachmentId = v7();
      const ext = path.extname(abs);

      const fileNameWithExt =
        sanitizeFileName(path.basename(abs, ext)) + ext.toLowerCase();

      const storageFilePath = `${getAttachmentFolderPath(AttachmentType.File, fileTask.workspaceId)}/${attachmentId}/${fileNameWithExt}`;

      const apiFilePath = `/api/files/${attachmentId}/${fileNameWithExt}`;

      tasks.push(
        (async () => {
          const fileStream = createReadStream(abs);
          await this.storageService.uploadStream(storageFilePath, fileStream);
          const stat = await fs.stat(abs);

          const uploaded = await this.db
            .insertInto('attachments')
            .values({
              id: attachmentId,
              filePath: storageFilePath,
              fileName: fileNameWithExt,
              fileSize: stat.size,
              mimeType: getMimeType(fileNameWithExt),
              type: 'file',
              fileExt: ext,
              creatorId: fileTask.creatorId,
              workspaceId: fileTask.workspaceId,
              pageId,
              spaceId: fileTask.spaceId,
            })
            .returningAll()
            .execute();
          console.log(uploaded);
        })(),
      );

      return {
        attachmentId,
        storageFilePath,
        apiFilePath,
        fileNameWithExt,
        abs,
      };
    };

    const pageDir = path.dirname(pageRelativePath);

    for (const img of Array.from(doc.getElementsByTagName('img'))) {
      const src = cleanUrlString(img.getAttribute('src')) ?? '';
      if (!src || src.startsWith('http')) continue;

      const relPath = this.resolveRelativeAttachmentPath(
        src,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);

      const width = img.getAttribute('width') || '100%';
      const align = img.getAttribute('data-align') || 'center';

      img.setAttribute('src', apiFilePath);
      img.setAttribute('data-attachment-id', attachmentId);
      img.setAttribute('data-size', stat.size.toString());
      img.setAttribute('width', width);
      img.setAttribute('data-align', align);

      this.unwrapFromParagraph(img);
    }

    // rewrite <video>
    for (const vid of Array.from(doc.getElementsByTagName('video'))) {
      const src = cleanUrlString(vid.getAttribute('src')) ?? '';
      if (!src || src.startsWith('http')) continue;

      const relPath = this.resolveRelativeAttachmentPath(
        src,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);

      const width = vid.getAttribute('width') || '100%';
      const align = vid.getAttribute('data-align') || 'center';

      vid.setAttribute('src', apiFilePath);
      vid.setAttribute('data-attachment-id', attachmentId);
      vid.setAttribute('data-size', stat.size.toString());
      vid.setAttribute('width', width);
      vid.setAttribute('data-align', align);

      // @ts-ignore
      this.unwrapFromParagraph(vid);
    }

    // rewrite other attachments via <a>
    for (const a of Array.from(doc.getElementsByTagName('a'))) {
      const href = cleanUrlString(a.getAttribute('href')) ?? '';
      if (!href || href.startsWith('http')) continue;

      const relPath = this.resolveRelativeAttachmentPath(
        href,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);
      const ext = path.extname(relPath).toLowerCase();

      if (ext === '.mp4') {
        const video = doc.createElement('video');
        video.setAttribute('src', apiFilePath);
        video.setAttribute('data-attachment-id', attachmentId);
        video.setAttribute('data-size', stat.size.toString());
        video.setAttribute('width', '100%');
        video.setAttribute('data-align', 'center');

        a.replaceWith(video);
        // @ts-ignore
        this.unwrapFromParagraph(video);
      } else {
        const div = doc.createElement('div') as HDElement;
        div.setAttribute('data-type', 'attachment');
        div.setAttribute('data-attachment-url', apiFilePath);
        div.setAttribute('data-attachment-name', path.basename(abs));
        div.setAttribute('data-attachment-mime', getMimeType(abs));
        div.setAttribute('data-attachment-size', stat.size.toString());
        div.setAttribute('data-attachment-id', attachmentId);

        a.replaceWith(div);
        this.unwrapFromParagraph(div);
      }
    }

    const attachmentDivs = Array.from(
      doc.querySelectorAll('div[data-type="attachment"]'),
    );
    for (const oldDiv of attachmentDivs) {
      const rawUrl =
        cleanUrlString(oldDiv.getAttribute('data-attachment-url')) ?? '';
      if (!rawUrl || rawUrl.startsWith('http')) continue;

      const relPath = this.resolveRelativeAttachmentPath(
        rawUrl,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);
      const fileName = path.basename(abs);
      const mime = getMimeType(abs);

      const div = doc.createElement('div') as HDElement;
      div.setAttribute('data-type', 'attachment');
      div.setAttribute('data-attachment-url', apiFilePath);
      div.setAttribute('data-attachment-name', fileName);
      div.setAttribute('data-attachment-mime', mime);
      div.setAttribute('data-attachment-size', stat.size.toString());
      div.setAttribute('data-attachment-id', attachmentId);

      oldDiv.replaceWith(div);
      this.unwrapFromParagraph(div);
    }

    for (const type of ['excalidraw', 'drawio'] as const) {
      const selector = `div[data-type="${type}"]`;
      const oldDivs = Array.from(doc.querySelectorAll(selector));

      for (const oldDiv of oldDivs) {
        const rawSrc = cleanUrlString(oldDiv.getAttribute('data-src')) ?? '';
        if (!rawSrc || rawSrc.startsWith('http')) continue;

        const relPath = this.resolveRelativeAttachmentPath(
          rawSrc,
          pageDir,
          attachmentCandidates,
        );
        if (!relPath) continue;

        const { attachmentId, apiFilePath, abs } = processFile(relPath);
        const stat = await fs.stat(abs);
        const fileName = path.basename(abs);

        const width = oldDiv.getAttribute('data-width') || '100%';
        const align = oldDiv.getAttribute('data-align') || 'center';

        const newDiv = doc.createElement('div') as HDElement;
        newDiv.setAttribute('data-type', type);
        newDiv.setAttribute('data-src', apiFilePath);
        newDiv.setAttribute('data-title', fileName);
        newDiv.setAttribute('data-width', width);
        newDiv.setAttribute('data-size', stat.size.toString());
        newDiv.setAttribute('data-align', align);
        newDiv.setAttribute('data-attachment-id', attachmentId);

        oldDiv.replaceWith(newDiv);
        this.unwrapFromParagraph(newDiv);
      }
    }

    // wait for all uploads & DB inserts
    await Promise.all(tasks);

    return doc.documentElement.outerHTML;
  }

  async rewriteInternalLinksToMentionHtml(
    html: string,
    currentFilePath: string,
    filePathToPageMetaMap: Map<
      string,
      { id: string; title: string; slugId: string }
    >,
    creatorId: string,
  ): Promise<string> {
    const window = new Window();
    const doc = window.document;
    doc.body.innerHTML = html;

    // normalize helper
    const normalize = (p: string) => p.replace(/\\/g, '/');

    for (const a of Array.from(doc.getElementsByTagName('a'))) {
      const rawHref = a.getAttribute('href');
      if (!rawHref) continue;

      // skip absolute/external URLs
      if (rawHref.startsWith('http') || rawHref.startsWith('/api/')) {
        continue;
      }

      const decodedRef = decodeURIComponent(rawHref);
      const parentDir = path.dirname(currentFilePath);
      const joined = path.join(parentDir, decodedRef);
      const resolved = normalize(joined);

      const pageMeta = filePathToPageMetaMap.get(resolved);
      if (!pageMeta) {
        // not an internal link we know about
        continue;
      }

      const mentionEl = doc.createElement('span') as HDElement;
      mentionEl.setAttribute('data-type', 'mention');
      mentionEl.setAttribute('data-id', v7());
      mentionEl.setAttribute('data-entity-type', 'page');
      mentionEl.setAttribute('data-entity-id', pageMeta.id);
      mentionEl.setAttribute('data-label', pageMeta.title);
      mentionEl.setAttribute('data-slug-id', pageMeta.slugId);
      mentionEl.setAttribute('data-creator-id', creatorId);
      mentionEl.textContent = pageMeta.title;

      a.replaceWith(mentionEl);
    }

    return doc.body.innerHTML;
  }

  unwrapFromParagraph(node: HDElement) {
    let wrapper = node.closest('p, a') as HDElement | null;

    while (wrapper) {
      if (wrapper.childNodes.length === 1) {
        // e.g. <p><node/></p> or <a><node/></a> → <node/>
        wrapper.replaceWith(node);
      } else {
        wrapper.parentNode!.insertBefore(node, wrapper);
      }
      wrapper = node.closest('p, a') as HDElement | null;
    }
  }

  async buildAttachmentCandidates(
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

  async collectMarkdownAndHtmlFiles(dir: string): Promise<string[]> {
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

  resolveRelativeAttachmentPath(
    raw: string,
    pageDir: string,
    attachmentCandidates: Map<string, string>,
  ): string | null {
    const mainRel = decodeURIComponent(raw.replace(/^\.?\/+/, ''));
    const fallback = path.normalize(path.join(pageDir, mainRel));

    if (attachmentCandidates.has(mainRel)) {
      return mainRel;
    }
    if (attachmentCandidates.has(fallback)) {
      return fallback;
    }
    return null;
  }

  async updateTaskStatus(fileTaskId: string, status: FileTaskStatus) {
    await this.db
      .updateTable('fileTasks')
      .set({ status: status })
      .where('id', '=', fileTaskId)
      .execute();
  }
}
