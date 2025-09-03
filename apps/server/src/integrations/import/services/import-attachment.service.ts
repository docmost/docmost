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

    this.logger.debug(`Found ${drawioPairs.size} Draw.io pairs to process`);

    // Process Draw.io pairs and create combined SVG files
    for (const [drawioHref, pair] of drawioPairs) {
      if (!pair.drawioFile) continue;

      const drawioAbsPath = attachmentCandidates.get(drawioHref);
      if (!drawioAbsPath) continue;

      const pngAbsPath = pair.pngFile
        ? attachmentCandidates.get(pair.pngFile.href)
        : undefined;

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
      } catch (error) {
        this.logger.error(
          `Failed to process Draw.io pair ${pair.baseName}:`,
          error,
        );
      }
    }

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

    // Cache for resolved paths to avoid repeated lookups
    const resolvedPathCache = new Map<string, string | null>();

    const getCachedResolvedPath = (rawPath: string): string | null => {
      if (resolvedPathCache.has(rawPath)) {
        return resolvedPathCache.get(rawPath)!;
      }
      const resolved = resolveRelativeAttachmentPath(
        rawPath,
        pageDir,
        attachmentCandidates,
      );
      resolvedPathCache.set(rawPath, resolved);
      return resolved;
    };

    // Cache for file stats to avoid repeated file system calls
    const statCache = new Map<string, any>();

    const getCachedStat = async (absPath: string) => {
      if (statCache.has(absPath)) {
        return statCache.get(absPath);
      }
      const stat = await fs.stat(absPath);
      statCache.set(absPath, stat);
      return stat;
    };

    // Single DOM traversal for all attachment elements
    const selector =
      'img, video, div[data-type="attachment"], a, div[data-type="excalidraw"], div[data-type="drawio"]';
    const elements = $(selector).toArray();

    for (const element of elements) {
      const $el = $(element);
      const tagName = element.tagName.toLowerCase();

      // Process based on element type
      if (tagName === 'img') {
        const src = cleanUrlString($el.attr('src') ?? '');
        if (!src || src.startsWith('http')) continue;

        const relPath = getCachedResolvedPath(src);
        if (!relPath) continue;

        // Check if this image is part of a Draw.io pair
        const drawioSvg = drawioSvgMap.get(relPath);
        if (drawioSvg) {
          const $drawio = $('<div>')
            .attr('data-type', 'drawio')
            .attr('data-src', drawioSvg.apiFilePath)
            .attr('data-title', 'diagram')
            .attr('data-width', '100%')
            .attr('data-align', 'center')
            .attr('data-attachment-id', drawioSvg.attachmentId);

          $el.replaceWith($drawio);
          unwrapFromParagraph($, $drawio);
          continue;
        }

        const { attachmentId, apiFilePath, abs } = processFile(relPath);
        const stat = await getCachedStat(abs);

        $el
          .attr('src', apiFilePath)
          .attr('data-attachment-id', attachmentId)
          .attr('data-size', stat.size.toString())
          .attr('width', $el.attr('width') ?? '100%')
          .attr('data-align', $el.attr('data-align') ?? 'center');

        unwrapFromParagraph($, $el);
      } else if (tagName === 'video') {
        const src = cleanUrlString($el.attr('src') ?? '');
        if (!src || src.startsWith('http')) continue;

        const relPath = getCachedResolvedPath(src);
        if (!relPath) continue;

        const { attachmentId, apiFilePath, abs } = processFile(relPath);
        const stat = await getCachedStat(abs);

        $el
          .attr('src', apiFilePath)
          .attr('data-attachment-id', attachmentId)
          .attr('data-size', stat.size.toString())
          .attr('width', $el.attr('width') ?? '100%')
          .attr('data-align', $el.attr('data-align') ?? 'center');

        unwrapFromParagraph($, $el);
      } else if (tagName === 'div') {
        const dataType = $el.attr('data-type');

        if (dataType === 'attachment') {
          const rawUrl = cleanUrlString($el.attr('data-attachment-url') ?? '');
          if (!rawUrl || rawUrl.startsWith('http')) continue;

          const relPath = getCachedResolvedPath(rawUrl);
          if (!relPath) continue;

          const { attachmentId, apiFilePath, abs } = processFile(relPath);
          const stat = await getCachedStat(abs);
          const fileName = path.basename(abs);
          const mime = getMimeType(abs);

          const $newDiv = $('<div>')
            .attr('data-type', 'attachment')
            .attr('data-attachment-url', apiFilePath)
            .attr('data-attachment-name', fileName)
            .attr('data-attachment-mime', mime)
            .attr('data-attachment-size', stat.size.toString())
            .attr('data-attachment-id', attachmentId);

          $el.replaceWith($newDiv);
          unwrapFromParagraph($, $newDiv);
        } else if (dataType === 'excalidraw' || dataType === 'drawio') {
          const rawSrc = cleanUrlString($el.attr('data-src') ?? '');
          if (!rawSrc || rawSrc.startsWith('http')) continue;

          const relPath = getCachedResolvedPath(rawSrc);
          if (!relPath) continue;

          const { attachmentId, apiFilePath, abs } = processFile(relPath);
          const stat = await getCachedStat(abs);
          const fileName = path.basename(abs);

          const $newDiv = $('<div>')
            .attr('data-type', dataType)
            .attr('data-src', apiFilePath)
            .attr('data-title', fileName)
            .attr('data-width', $el.attr('data-width') || '100%')
            .attr('data-size', stat.size.toString())
            .attr('data-align', $el.attr('data-align') || 'center')
            .attr('data-attachment-id', attachmentId);

          $el.replaceWith($newDiv);
          unwrapFromParagraph($, $newDiv);
        }
      } else if (tagName === 'a') {
        const href = cleanUrlString($el.attr('href') ?? '');
        if (!href || href.startsWith('http')) continue;

        const relPath = getCachedResolvedPath(href);
        if (!relPath) continue;

        // Check if this is a Draw.io file
        const drawioSvg = drawioSvgMap.get(relPath);
        if (drawioSvg) {
          const $drawio = $('<div>')
            .attr('data-type', 'drawio')
            .attr('data-src', drawioSvg.apiFilePath)
            .attr('data-title', 'diagram')
            .attr('data-width', '100%')
            .attr('data-align', 'center')
            .attr('data-attachment-id', drawioSvg.attachmentId);

          $el.replaceWith($drawio);
          unwrapFromParagraph($, $drawio);
          continue;
        }

        // Skip files that should be ignored
        if (skipFiles.has(relPath)) {
          $el.remove();
          continue;
        }

        const { attachmentId, apiFilePath, abs } = processFile(relPath);
        const stat = await getCachedStat(abs);
        const ext = path.extname(relPath).toLowerCase();

        if (ext === '.mp4') {
          const $video = $('<video>')
            .attr('src', apiFilePath)
            .attr('data-attachment-id', attachmentId)
            .attr('data-size', stat.size.toString())
            .attr('width', '100%')
            .attr('data-align', 'center');
          $el.replaceWith($video);
          unwrapFromParagraph($, $video);
        } else {
          const confAliasName = $el.attr('data-linked-resource-default-alias');
          let attachmentName = path.basename(abs);
          if (confAliasName) attachmentName = confAliasName;

          const $div = $('<div>')
            .attr('data-type', 'attachment')
            .attr('data-attachment-url', apiFilePath)
            .attr('data-attachment-name', attachmentName)
            .attr('data-attachment-mime', getMimeType(abs))
            .attr('data-attachment-size', stat.size.toString())
            .attr('data-attachment-id', attachmentId);

          $el.replaceWith($div);
          unwrapFromParagraph($, $div);
        }
      }
    }

    // Collect all attachment IDs in the HTML in a single DOM traversal - O(n)
    const usedAttachmentIds = new Set<string>();
    $.root()
      .find('[data-attachment-id]')
      .each((_, el) => {
        const attachmentId = $(el).attr('data-attachment-id');
        if (attachmentId) {
          usedAttachmentIds.add(attachmentId);
        }
      });

    // Add Draw.io diagrams that weren't referenced in the HTML content
    for (const [drawioHref, pair] of drawioPairs) {
      const drawioSvg = drawioSvgMap.get(drawioHref);
      if (!drawioSvg) continue;

      if (usedAttachmentIds.has(drawioSvg.attachmentId)) {
        continue; // Already in content
      }

      const $drawio = $('<div>')
        .attr('data-type', 'drawio')
        .attr('data-src', drawioSvg.apiFilePath)
        .attr('data-title', 'diagram')
        .attr('data-width', '100%')
        .attr('data-align', 'center')
        .attr('data-attachment-id', drawioSvg.attachmentId);

      $.root().append($drawio);
    }

    // Process attachments from the attachment section that weren't referenced in HTML
    // These need to be added as attachment nodes so they get uploaded
    for (const attachment of pageAttachments) {
      const { href, fileName, mimeType } = attachment;

      // Skip temporary files or files that should be ignored
      if (skipFiles.has(href)) {
        continue;
      }

      // Check if this was part of a Draw.io pair that was already handled
      if (drawioSvgMap.has(href)) {
        continue;
      }

      // Check if already processed (was referenced in HTML)
      if (processed.has(href)) {
        continue;
      }

      // Skip if the file doesn't exist
      if (!attachmentCandidates.has(href)) {
        continue;
      }

      // This attachment was in the list but not referenced in HTML - add it
      const { attachmentId, apiFilePath, abs } = processFile(href);

      try {
        const stat = await fs.stat(abs);
        const mime = mimeType || getMimeType(abs);

        // Add as attachment node at the end
        const $attachmentDiv = $('<div>')
          .attr('data-type', 'attachment')
          .attr('data-attachment-url', apiFilePath)
          .attr('data-attachment-name', fileName)
          .attr('data-attachment-mime', mime)
          .attr('data-attachment-size', stat.size.toString())
          .attr('data-attachment-id', attachmentId);

        $.root().append($attachmentDiv);
      } catch (error) {
        this.logger.error(`Failed to process attachment ${fileName}:`, error);
      }
    }

    // wait for all uploads & DB inserts
    uploadStats.total = attachmentTasks.length;

    if (uploadStats.total > 0) {
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

    // Group attachments by type
    const drawioFiles: AttachmentInfo[] = [];
    const pngByBaseName = new Map<string, AttachmentInfo[]>();

    const nonDrawioExtensions = new Set([
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
    ]);

    // Single pass through attachments
    for (const attachment of attachments) {
      const { fileName, mimeType, href } = attachment;
      const fileNameLower = fileName.toLowerCase();

      // Skip temporary files
      if (fileName.endsWith('.tmp') || fileName.includes('~drawio~')) {
        skipFiles.add(href);
        continue;
      }

      // Check for Draw.io files
      if (mimeType === 'application/vnd.jgraph.mxfile') {
        const ext = fileNameLower.substring(fileNameLower.lastIndexOf('.'));
        if (!nonDrawioExtensions.has(ext)) {
          drawioFiles.push(attachment);
        } else {
          //Skipped non-Draw.io file with mxfile MIME.}`,
        }
      }

      if (mimeType === 'image/png' || fileNameLower.endsWith('.png')) {
        const baseNames: string[] = [];

        if (fileName.endsWith('.drawio.png')) {
          // Cloud format: "name.drawio.png" -> base is "name"
          baseNames.push(fileName.slice(0, -11)); // Remove .drawio.png
        } else if (fileName.endsWith('.png')) {
          // Server format: "name.png" -> base is "name"
          baseNames.push(fileName.slice(0, -4)); // Remove .png
        }

        for (const baseName of baseNames) {
          if (!pngByBaseName.has(baseName)) {
            pngByBaseName.set(baseName, []);
          }
          pngByBaseName.get(baseName)!.push(attachment);
        }
      }
    }

    // Match Draw.io files with PNG counterparts
    for (const drawio of drawioFiles) {
      let baseName: string;

      if (drawio.fileName.endsWith('.drawio')) {
        baseName = drawio.fileName.slice(0, -7); // Remove .drawio
      } else {
        // Confluence Server: no extension
        baseName = drawio.fileName;
      }

      const candidatePngs = pngByBaseName.get(baseName) || [];
      let matchingPng: AttachmentInfo | undefined;

      // Extract the attachment ID from the Draw.io href
      // Format: attachments/16941088/36044817.png -> ID is 36044817
      const drawioIdMatch = drawio.href.match(/\/(\d+)\.\w+$/);
      const drawioId = drawioIdMatch ? drawioIdMatch[1] : null;

      if (drawioId) {
        // Look for PNG with adjacent ID (usually PNG ID = Draw.io ID + small increment)
        // In Confluence, related files often have sequential or near-sequential IDs
        for (const png of candidatePngs) {
          const pngIdMatch = png.href.match(/\/(\d+)\.png$/);
          const pngId = pngIdMatch ? pngIdMatch[1] : null;

          //TODO: should revisit this
          // but seem to be the best option for now
          // to prevent reusing the first drawio preview image if there are more with the same name
          if (pngId && drawioId) {
            const idDiff = Math.abs(parseInt(pngId) - parseInt(drawioId));
            // PNG is usually within ~30 IDs of the Draw.io file
            if (idDiff <= 30) {
              // Verify filename match
              if (
                png.fileName === `${baseName}.drawio.png` ||
                (!drawio.fileName.endsWith('.drawio') &&
                  png.fileName === `${baseName}.png`)
              ) {
                matchingPng = png;
                break;
              }
            }
          }
        }
      }

      // Fallback to name-only matching if ID-based matching fails
      if (!matchingPng) {
        for (const png of candidatePngs) {
          if (png.fileName === `${baseName}.drawio.png`) {
            matchingPng = png;
            break;
          }
          if (
            !drawio.fileName.endsWith('.drawio') &&
            png.fileName === `${baseName}.png`
          ) {
            matchingPng = png;
            break;
          }
        }
      }

      if (matchingPng) {
        this.logger.debug(
          `Found Draw.io pair: ${drawio.fileName} -> ${matchingPng.fileName}`,
        );
      } else {
        this.logger.debug(`No PNG found for Draw.io file: ${drawio.fileName}`);
      }

      const pair: DrawioPair = {
        drawioFile: drawio,
        pngFile: matchingPng,
        baseName,
      };

      drawioPairs.set(drawio.href, pair);
      skipFiles.add(drawio.href);
      if (matchingPng) {
        skipFiles.add(matchingPng.href);
        // Remove the matched PNG from the candidates to prevent reuse
        const remainingPngs = pngByBaseName
          .get(baseName)
          ?.filter((png) => png.href !== matchingPng.href);
        if (remainingPngs && remainingPngs.length > 0) {
          pngByBaseName.set(baseName, remainingPngs);
        } else {
          pngByBaseName.delete(baseName);
        }
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

          imageElement = `<image href="data:image/png;base64,${pngBase64}" width="100%" height="100%"/>`;
        } catch (error) {
          this.logger.warn(
            `Could not read PNG file for Draw.io diagram: ${pngPath}`,
            error,
          );
        }
      }

      // Create the SVG with embedded Draw.io data and image
      // Default dimensions for Draw.io diagrams if no image is provided
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" 
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="600"
      height="400"
      viewBox="0 0 600 400"
      content="${drawioBase64}">${imageElement}</svg>`;

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
