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
import { markdownToHtml } from '@docmost/editor-ext';
import { getAttachmentFolderPath } from '../../core/attachment/attachment.utils';
import { AttachmentType } from '../../core/attachment/attachment.constants';
import { getProsemirrorContent } from '../../common/helpers/prosemirror/utils';
import { formatImportHtml, unwrapFromParagraph } from './import-formatter';
import {
  buildAttachmentCandidates,
  collectMarkdownAndHtmlFiles,
  resolveRelativeAttachmentPath,
} from './import.utils';
import { executeTx } from '@docmost/db/utils';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { load } from 'cheerio';

@Injectable()
export class FileTaskService {
  private readonly logger = new Logger(FileTaskService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly importService: ImportService,
    private readonly backlinkRepo: BacklinkRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async processZIpImport(fileTaskId: string): Promise<void> {
    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', fileTaskId)
      .executeTakeFirst();

    if (!fileTask) {
      this.logger.log(`Import file task with ID ${fileTaskId} not found`);
      return;
    }

    if (fileTask.status === FileTaskStatus.Success) {
      this.logger.log('Imported task already processed.');
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

    try {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Processing);
      // if type == generic
      if (fileTask.source === 'generic') {
        await this.processGenericImport({
          extractDir: tmpExtractDir,
          fileTask,
        });
      }

      /*
      if (fileTask.source === 'confluence') {
        await this.processConfluenceImport({
          extractDir: tmpExtractDir,
          fileTask,
        });
      }*/
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Success);
    } catch (error) {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Failed);
      this.logger.error(error);
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
    const allFiles = await collectMarkdownAndHtmlFiles(extractDir);
    const attachmentCandidates = await buildAttachmentCandidates(extractDir);

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

      if (ext.toLowerCase() === '.md') {
        content = await markdownToHtml(content);
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

    const pageResults = await Promise.all(
      Array.from(pagesMap.values()).map(async (page) => {
        const htmlContent = await this.rewriteLocalFilesInHtml({
          html: page.content,
          pageRelativePath: page.filePath,
          extractDir,
          pageId: page.id,
          fileTask,
          attachmentCandidates,
        });

        const { html, backlinks } = await formatImportHtml({
          html: htmlContent,
          currentFilePath: page.filePath,
          filePathToPageMetaMap: filePathToPageMetaMap,
          creatorId: fileTask.creatorId,
          sourcePageId: page.id,
          workspaceId: fileTask.workspaceId,
        });

        const pmState = getProsemirrorContent(
          await this.importService.processHTML(html),
        );

        const { title, prosemirrorJson } =
          this.importService.extractTitleAndRemoveHeading(pmState);

        const insertablePage: InsertablePage = {
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

        return { insertablePage, backlinks };
      }),
    );

    const insertablePages = pageResults.map((r) => r.insertablePage);
    const insertableBacklinks = pageResults.flatMap((r) => r.backlinks);

    if (insertablePages.length < 1) return;
    const validPageIds = new Set(insertablePages.map((row) => row.id));
    const filteredBacklinks = insertableBacklinks.filter(
      ({ sourcePageId, targetPageId }) =>
        validPageIds.has(sourcePageId) && validPageIds.has(targetPageId),
    );

    await executeTx(this.db, async (trx) => {
      await trx.insertInto('pages').values(insertablePages).execute();

      if (filteredBacklinks.length > 0) {
        await this.backlinkRepo.insertBacklink(filteredBacklinks, trx);
      }
    });
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

    const attachmentTasks: Promise<void>[] = [];

    const processFile = (relPath: string) => {
      const abs = attachmentCandidates.get(relPath)!;
      const attachmentId = v7();
      const ext = path.extname(abs);

      const fileNameWithExt =
        sanitizeFileName(path.basename(abs, ext)) + ext.toLowerCase();

      const storageFilePath = `${getAttachmentFolderPath(AttachmentType.File, fileTask.workspaceId)}/${attachmentId}/${fileNameWithExt}`;

      const apiFilePath = `/api/files/${attachmentId}/${fileNameWithExt}`;

      attachmentTasks.push(
        (async () => {
          const fileStream = createReadStream(abs);
          await this.storageService.uploadStream(storageFilePath, fileStream);
          const stat = await fs.stat(abs);

          await this.db
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
            .execute();
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
    const $ = load(html);

    // image
    for (const imgEl of $('img').toArray()) {
      const $img = $(imgEl);
      const src = cleanUrlString($img.attr('src') ?? '')!;
      if (!src || src.startsWith('http')) continue;

      const relPath = resolveRelativeAttachmentPath(
        src,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);

      const width = $img.attr('width') ?? '100%';
      const align = $img.attr('data-align') ?? 'center';

      $img
        .attr('src', apiFilePath)
        .attr('data-attachment-id', attachmentId)
        .attr('data-size', stat.size.toString())
        .attr('width', width)
        .attr('data-align', align);

      unwrapFromParagraph($, $img);
    }

    // video
    for (const vidEl of $('video').toArray()) {
      const $vid = $(vidEl);
      const src = cleanUrlString($vid.attr('src') ?? '')!;
      if (!src || src.startsWith('http')) continue;

      const relPath = resolveRelativeAttachmentPath(
        src,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);

      const width = $vid.attr('width') ?? '100%';
      const align = $vid.attr('data-align') ?? 'center';

      $vid
        .attr('src', apiFilePath)
        .attr('data-attachment-id', attachmentId)
        .attr('data-size', stat.size.toString())
        .attr('width', width)
        .attr('data-align', align);

      unwrapFromParagraph($, $vid);
    }

    for (const el of $('div[data-type="attachment"]').toArray()) {
      const $oldDiv = $(el);
      const rawUrl = cleanUrlString($oldDiv.attr('data-attachment-url') ?? '')!;
      if (!rawUrl || rawUrl.startsWith('http')) continue;

      const relPath = resolveRelativeAttachmentPath(
        rawUrl,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);
      const fileName = path.basename(abs);
      const mime = getMimeType(abs);

      const $newDiv = $('<div>')
        .attr('data-type', 'attachment')
        .attr('data-attachment-url', apiFilePath)
        .attr('data-attachment-name', fileName)
        .attr('data-attachment-mime', mime)
        .attr('data-attachment-size', stat.size.toString())
        .attr('data-attachment-id', attachmentId);

      $oldDiv.replaceWith($newDiv);
      unwrapFromParagraph($, $newDiv);
    }

    // rewrite other attachments via <a>
    for (const aEl of $('a').toArray()) {
      const $a = $(aEl);
      const href = cleanUrlString($a.attr('href') ?? '')!;
      if (!href || href.startsWith('http')) continue;

      const relPath = resolveRelativeAttachmentPath(
        href,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) continue;

      const { attachmentId, apiFilePath, abs } = processFile(relPath);
      const stat = await fs.stat(abs);
      const ext = path.extname(relPath).toLowerCase();

      if (ext === '.mp4') {
        const $video = $('<video>')
          .attr('src', apiFilePath)
          .attr('data-attachment-id', attachmentId)
          .attr('data-size', stat.size.toString())
          .attr('width', '100%')
          .attr('data-align', 'center');
        $a.replaceWith($video);
        unwrapFromParagraph($, $video);
      } else {
        // build attachment <div>
        const confAliasName = $a.attr('data-linked-resource-default-alias');
        let attachmentName = path.basename(abs);
        if (confAliasName) attachmentName = confAliasName;

        const $div = $('<div>')
          .attr('data-type', 'attachment')
          .attr('data-attachment-url', apiFilePath)
          .attr('data-attachment-name', attachmentName)
          .attr('data-attachment-mime', getMimeType(abs))
          .attr('data-attachment-size', stat.size.toString())
          .attr('data-attachment-id', attachmentId);

        $a.replaceWith($div);
        unwrapFromParagraph($, $div);
      }
    }

    // excalidraw and drawio
    for (const type of ['excalidraw', 'drawio'] as const) {
      for (const el of $(`div[data-type="${type}"]`).toArray()) {
        const $oldDiv = $(el);
        const rawSrc = cleanUrlString($oldDiv.attr('data-src') ?? '')!;
        if (!rawSrc || rawSrc.startsWith('http')) continue;

        const relPath = resolveRelativeAttachmentPath(
          rawSrc,
          pageDir,
          attachmentCandidates,
        );
        if (!relPath) continue;

        const { attachmentId, apiFilePath, abs } = processFile(relPath);
        const stat = await fs.stat(abs);
        const fileName = path.basename(abs);

        const width = $oldDiv.attr('data-width') || '100%';
        const align = $oldDiv.attr('data-align') || 'center';

        const $newDiv = $('<div>')
          .attr('data-type', type)
          .attr('data-src', apiFilePath)
          .attr('data-title', fileName)
          .attr('data-width', width)
          .attr('data-size', stat.size.toString())
          .attr('data-align', align)
          .attr('data-attachment-id', attachmentId);

        $oldDiv.replaceWith($newDiv);
        unwrapFromParagraph($, $newDiv);
      }
    }

    // wait for all uploads & DB inserts
    await Promise.all(attachmentTasks);

    return $.root().html() || '';
  }

  async updateTaskStatus(fileTaskId: string, status: FileTaskStatus) {
    await this.db
      .updateTable('fileTasks')
      .set({ status: status })
      .where('id', '=', fileTaskId)
      .execute();
  }
}
