import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { cleanUrlString } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'fs';
import { Readable } from 'stream';
import { getMimeType, sanitizeFileName } from '../../../common/helpers';
import { v7 } from 'uuid';
import { FileTask } from '@docmost/db/types/entity.types';
import { getAttachmentFolderPath } from '../../../core/attachment/attachment.utils';
import { AttachmentType } from '../../../core/attachment/attachment.constants';
import { unwrapFromParagraph } from '../utils/import-formatter';
import { resolveRelativeAttachmentPath } from '../utils/import.utils';
import { load } from 'cheerio';
import pLimit from 'p-limit';

interface AttachmentInfo {
  href: string;
  fileName: string;
  mimeType: string;
}

interface DrawioPair {
  drawioFile?: AttachmentInfo;
  pngFile?: AttachmentInfo;
  baseName: string;
}

@Injectable()
export class ImportAttachmentService {
  private readonly logger = new Logger(ImportAttachmentService.name);
  private readonly CONCURRENT_UPLOADS = 3;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 2000;

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
    pageAttachments?: AttachmentInfo[];
  }): Promise<string> {
    const {
      html,
      pageRelativePath,
      extractDir,
      pageId,
      fileTask,
      attachmentCandidates,
      pageAttachments = [],
    } = opts;

    const attachmentTasks: (() => Promise<void>)[] = [];
    const limit = pLimit(this.CONCURRENT_UPLOADS);
    const uploadStats = {
      total: 0,
      completed: 0,
      failed: 0,
      failedFiles: [] as string[],
    };

    /**
     * Cache keyed by the *relative* path that appears in the HTML.
     * Ensures we upload (and DB-insert) each attachment at most once,
     * even if it's referenced multiple times on the page.
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

    // Analyze attachments to identify Draw.io pairs
    const { drawioPairs, skipFiles } = this.analyzeAttachments(pageAttachments);

    // Map to store processed Draw.io SVGs
    const drawioSvgMap = new Map<
      string,
      {
        attachmentId: string;
        apiFilePath: string;
        fileName: string;
      }
    >();

    // Debug: log the drawioPairs
    this.logger.debug(`Found ${drawioPairs.size} Draw.io pairs to process`);

    // Process Draw.io pairs and create combined SVG files
    for (const [drawioHref, pair] of drawioPairs) {
      if (!pair.drawioFile) continue;

      const drawioAbsPath = attachmentCandidates.get(drawioHref);
      if (!drawioAbsPath) continue;

      const pngAbsPath = pair.pngFile
        ? attachmentCandidates.get(pair.pngFile.href)
        : undefined;

      this.logger.debug(
        `Processing Draw.io: ${drawioHref} -> PNG: ${pair.pngFile?.href || 'none'}`,
      );
      this.logger.debug(
        `Draw.io path: ${drawioAbsPath}, PNG path: ${pngAbsPath || 'none'}`,
      );

      try {
        // Create combined SVG with Draw.io data and PNG image
        const svgBuffer = await this.createDrawioSvg(drawioAbsPath, pngAbsPath);

        // Generate file details - always use "diagram.drawio.svg" as filename
        const attachmentId = v7();
        const fileName = 'diagram.drawio.svg';
        const storageFilePath = `${getAttachmentFolderPath(
          AttachmentType.File,
          fileTask.workspaceId,
        )}/${attachmentId}/${fileName}`;
        const apiFilePath = `/api/files/${attachmentId}/${fileName}`;

        // Upload the SVG file
        attachmentTasks.push(async () => {
          try {
            // Convert buffer to stream for upload
            const stream = Readable.from(svgBuffer);

            // Upload to storage
            await this.storageService.uploadStream(storageFilePath, stream);

            // Insert into database
            await this.db
              .insertInto('attachments')
              .values({
                id: attachmentId,
                filePath: storageFilePath,
                fileName: fileName,
                fileSize: svgBuffer.length,
                mimeType: 'image/svg+xml',
                type: 'file',
                fileExt: '.svg',
                creatorId: fileTask.creatorId,
                workspaceId: fileTask.workspaceId,
                pageId,
                spaceId: fileTask.spaceId,
              })
              .execute();

            uploadStats.completed++;

            if (uploadStats.completed % 10 === 0) {
              this.logger.debug(
                `Upload progress: ${uploadStats.completed}/${uploadStats.total}`,
              );
            }
          } catch (error) {
            uploadStats.failed++;
            uploadStats.failedFiles.push(fileName);
            this.logger.error(
              `Failed to upload Draw.io SVG ${fileName}:`,
              error,
            );
          }
        });

        // Store the mapping for both Draw.io and PNG references
        drawioSvgMap.set(drawioHref, { attachmentId, apiFilePath, fileName });
        if (pair.pngFile) {
          drawioSvgMap.set(pair.pngFile.href, {
            attachmentId,
            apiFilePath,
            fileName,
          });
        }

        this.logger.debug(
          `Added Draw.io SVG mapping: ${drawioHref} -> ${attachmentId}`,
        );
        if (pair.pngFile) {
          this.logger.debug(
            `Added PNG mapping: ${pair.pngFile.href} -> ${attachmentId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process Draw.io pair ${pair.baseName}:`,
          error,
        );
      }
    }

    this.logger.debug(`Draw.io SVG map has ${drawioSvgMap.size} entries`);

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

      attachmentTasks.push(() =>
        this.uploadWithRetry({
          abs,
          storageFilePath,
          attachmentId,
          fileNameWithExt,
          ext,
          pageId,
          fileTask,
          uploadStats,
        }),
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

      // Check if this is a Draw.io file that was already processed
      const drawioSvg = drawioSvgMap.get(relPath);
      if (drawioSvg) {
        const $drawio = $('<div>')
          .attr('data-type', 'drawio')
          .attr('data-src', drawioSvg.apiFilePath)
          .attr('data-title', 'diagram')
          .attr('data-width', '100%')
          .attr('data-align', 'center')
          .attr('data-attachment-id', drawioSvg.attachmentId);

        $a.replaceWith($drawio);
        unwrapFromParagraph($, $drawio);
        continue;
      }

      // Skip files that should be ignored (temp files, etc)
      if (skipFiles.has(relPath)) {
        $a.remove();
        continue;
      }

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
    uploadStats.total = attachmentTasks.length;

    if (uploadStats.total > 0) {
      this.logger.debug(
        `Starting upload of ${uploadStats.total} attachments...`,
      );

      try {
        await Promise.all(attachmentTasks.map((task) => limit(task)));
      } catch (err) {
        this.logger.error('Import attachment upload error', err);
      }

      this.logger.debug(
        `Upload completed: ${uploadStats.completed}/${uploadStats.total} successful, ${uploadStats.failed} failed`,
      );

      if (uploadStats.failed > 0) {
        this.logger.warn(
          `Failed to upload ${uploadStats.failed} files:`,
          uploadStats.failedFiles,
        );
      }
    }

    return $.root().html() || '';
  }

  private analyzeAttachments(attachments: AttachmentInfo[]): {
    drawioPairs: Map<string, DrawioPair>;
    skipFiles: Set<string>;
  } {
    const drawioPairs = new Map<string, DrawioPair>();
    const skipFiles = new Set<string>();

    this.logger.debug(`Analyzing ${attachments.length} attachments`);
    attachments.forEach((att) => {
      this.logger.debug(
        `Attachment: ${att.fileName} (${att.mimeType}) -> ${att.href}`,
      );
    });

    // Group attachments by type
    const drawioFiles: AttachmentInfo[] = [];
    const pngFiles: AttachmentInfo[] = [];

    for (const attachment of attachments) {
      const { fileName, mimeType, href } = attachment;

      // Skip temporary Draw.io files (should already be filtered in parseAttachmentSection, but double-check)
      if (fileName.endsWith('.tmp') || fileName.includes('~drawio~')) {
        skipFiles.add(href);
        this.logger.debug(
          `Skipping temporary file in analyzeAttachments: ${fileName}`,
        );
        continue;
      }

      // Identify Draw.io files by MIME type
      if (mimeType === 'application/vnd.jgraph.mxfile') {
        // Filter out files with non-drawio extensions that have wrong MIME
        // IMPORTANT: .png files should NEVER be Draw.io files, even if they have the wrong MIME type
        const nonDrawioExtensions = [
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.svg',
          '.txt',
          '.pdf',
          '.doc',
          '.docx',
          '.xls',
          '.xlsx',
          '.csv',
          '.zip',
          '.tar',
          '.gz',
        ];
        const hasNonDrawioExtension = nonDrawioExtensions.some((ext) =>
          fileName.toLowerCase().endsWith(ext),
        );

        if (!hasNonDrawioExtension) {
          drawioFiles.push(attachment);
          this.logger.debug(
            `Found Draw.io file: ${attachment.fileName} at ${attachment.href}`,
          );
        } else {
          this.logger.debug(
            `Skipped non-Draw.io file with mxfile MIME: ${attachment.fileName}`,
          );
        }
      }

      // Identify PNG files by MIME type OR file extension (as fallback for wrong MIME types)
      if (mimeType === 'image/png' || fileName.toLowerCase().endsWith('.png')) {
        pngFiles.push(attachment);
        this.logger.debug(
          `Found PNG file: ${attachment.fileName} at ${attachment.href}`,
        );
      }
    }

    // Match Draw.io files with their PNG counterparts
    for (const drawio of drawioFiles) {
      let baseName: string;

      // Confluence Cloud: has .drawio extension
      if (drawio.fileName.endsWith('.drawio')) {
        baseName = drawio.fileName.slice(0, -7); // Remove .drawio
      } else {
        // Confluence Server: no extension
        baseName = drawio.fileName;
      }

      // Find matching PNG
      const matchingPng = pngFiles.find((png) => {
        // Cloud format: "name.drawio.png"
        if (png.fileName === `${baseName}.drawio.png`) {
          this.logger.debug(
            `Matched Cloud format: ${png.fileName} === ${baseName}.drawio.png`,
          );
          return true;
        }

        // Server format: "name.png" where name matches exactly
        if (
          !drawio.fileName.endsWith('.drawio') &&
          png.fileName === `${baseName}.png`
        ) {
          this.logger.debug(
            `Matched Server format: ${png.fileName} === ${baseName}.png`,
          );
          return true;
        }

        return false;
      });

      // Debug logging
      if (matchingPng) {
        this.logger.debug(
          `Found Draw.io pair: ${drawio.fileName} -> ${matchingPng.fileName}`,
        );
      } else {
        this.logger.debug(
          `No PNG found for Draw.io file: ${drawio.fileName}, baseName: ${baseName}`,
        );
        this.logger.debug(
          `Available PNG files: ${pngFiles.map((p) => p.fileName).join(', ')}`,
        );
      }

      const pair: DrawioPair = {
        drawioFile: drawio,
        pngFile: matchingPng,
        baseName,
      };

      drawioPairs.set(drawio.href, pair);

      // Mark both files to be skipped from regular processing
      skipFiles.add(drawio.href);
      if (matchingPng) {
        skipFiles.add(matchingPng.href);
      }
    }

    return { drawioPairs, skipFiles };
  }

  private async createDrawioSvg(
    drawioPath: string,
    pngPath?: string,
  ): Promise<Buffer> {
    try {
      const drawioContent = await fs.readFile(drawioPath, 'utf-8');
      const drawioBase64 = Buffer.from(drawioContent).toString('base64');

      let imageElement = '';
      // If we have a PNG, include it in the SVG
      if (pngPath) {
        try {
          const pngBuffer = await fs.readFile(pngPath);
          const pngBase64 = pngBuffer.toString('base64');
          imageElement = `<image href="data:image/png;base64,${pngBase64}" />`;
        } catch (error) {
          this.logger.warn(
            `Could not read PNG file for Draw.io diagram: ${pngPath}`,
            error,
          );
        }
      }

      // Create the SVG with embedded Draw.io data and image
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      content="${drawioBase64}"> ${imageElement}</svg>`;

      return Buffer.from(svgContent, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to create Draw.io SVG: ${error}`);
      throw error;
    }
  }

  private async uploadWithRetry(opts: {
    abs: string;
    storageFilePath: string;
    attachmentId: string;
    fileNameWithExt: string;
    ext: string;
    pageId: string;
    fileTask: FileTask;
    uploadStats: {
      total: number;
      completed: number;
      failed: number;
      failedFiles: string[];
    };
  }): Promise<void> {
    const {
      abs,
      storageFilePath,
      attachmentId,
      fileNameWithExt,
      ext,
      pageId,
      fileTask,
      uploadStats,
    } = opts;

    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
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

        uploadStats.completed++;

        if (uploadStats.completed % 10 === 0) {
          this.logger.debug(
            `Upload progress: ${uploadStats.completed}/${uploadStats.total}`,
          );
        }

        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Upload attempt ${attempt}/${this.MAX_RETRIES} failed for ${fileNameWithExt}: ${error instanceof Error ? error.message : String(error)}`,
        );

        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.RETRY_DELAY * attempt),
          );
        }
      }
    }

    uploadStats.failed++;
    uploadStats.failedFiles.push(fileNameWithExt);
    this.logger.error(
      `Failed to upload ${fileNameWithExt} after ${this.MAX_RETRIES} attempts:`,
      lastError,
    );
  }
}
