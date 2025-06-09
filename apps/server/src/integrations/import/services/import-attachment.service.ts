import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { cleanUrlString } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'fs';
import { getMimeType, sanitizeFileName } from '../../../common/helpers';
import { v7 } from 'uuid';
import { FileTask } from '@docmost/db/types/entity.types';
import { getAttachmentFolderPath } from '../../../core/attachment/attachment.utils';
import { AttachmentType } from '../../../core/attachment/attachment.constants';
import { unwrapFromParagraph } from '../utils/import-formatter';
import { resolveRelativeAttachmentPath } from '../utils/import.utils';
import { load } from 'cheerio';

@Injectable()
export class ImportAttachmentService {
  private readonly logger = new Logger(ImportAttachmentService.name);

  constructor(
    private readonly storageService: StorageService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async processAttachments(opts: {
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

    /**
     * Cache keyed by the *relative* path that appears in the HTML.
     * Ensures we upload (and DB-insert) each attachment at most once,
     * even if it’s referenced multiple times on the page.
     */
    const processed = new Map<
      string,
      {
        attachmentId: string;
        storageFilePath: string;
        apiFilePath: string;
        fileNameWithExt: string;
        abs: string;
      }
    >();

    const uploadOnce = (relPath: string) => {
      const abs = attachmentCandidates.get(relPath)!;
      const attachmentId = v7();
      const ext = path.extname(abs);

      const fileNameWithExt =
        sanitizeFileName(path.basename(abs, ext)) + ext.toLowerCase();

      const storageFilePath = `${getAttachmentFolderPath(
        AttachmentType.File,
        fileTask.workspaceId,
      )}/${attachmentId}/${fileNameWithExt}`;

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

    /**
     * – Returns cached data if we’ve already processed this path.
     * – Otherwise calls `uploadOnce`, stores the result, and returns it.
     */
    const processFile = (relPath: string) => {
      const cached = processed.get(relPath);
      if (cached) return cached;

      const fresh = uploadOnce(relPath);
      processed.set(relPath, fresh);
      return fresh;
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

    // <div data-type="attachment">
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
    try {
      await Promise.all(attachmentTasks);
    } catch (err) {
      this.logger.log('Import attachment upload error', err);
    }

    return $.root().html() || '';
  }
}
