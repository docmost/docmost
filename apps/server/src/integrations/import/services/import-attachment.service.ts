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
import { imageDimensionsFromData } from 'image-dimensions';
import { CheerioAPI, load } from 'cheerio';
import pLimit from 'p-limit';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../queue/constants';
import { isBase64 } from 'class-validator';
import { EnvironmentService } from '../../environment/environment.service';
import * as bytes from 'bytes';
import * as mimeTypes from 'mime-types';

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

interface UploadStats {
  total: number;
  completed: number;
  failed: number;
  failedFiles: string[];
}

interface ResolvedFile {
  attachmentId: string;
  apiFilePath: string;
  fileName: string;
  mimeType: string;
  size?: number;
  /** Absolute path on disk. Only present for relative (archive) sources. */
  abs?: string;
  /** Decoded payload. Only present for embedded (`data:` URI) sources. */
  buffer?: Buffer;
}

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.webm',
  '.flac',
  '.aac',
]);

const MIME_EXTENSION_OVERRIDES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'audio/mpeg': '.mp3',
};

function resolveExtensionForMimeType(mimeType: string): string | null {
  const override = MIME_EXTENSION_OVERRIDES[mimeType];
  if (override) return override;

  const ext = mimeTypes.extension(mimeType);
  return ext ? `.${ext}` : null;
}

@Injectable()
export class ImportAttachmentService {
  private readonly logger = new Logger(ImportAttachmentService.name);
  private readonly CONCURRENT_UPLOADS = 3;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 2000;

  constructor(
    private readonly storageService: StorageService,
    private readonly environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
  ) {}


  private buildAttachmentNode(
    $: CheerioAPI,
    file: ResolvedFile,
    name?: string,
  ) {
    const $div = $('<div>')
      .attr('data-type', 'attachment')
      .attr('data-attachment-url', file.apiFilePath)
      .attr('data-attachment-name', name || file.fileName)
      .attr('data-attachment-mime', file.mimeType)
      .attr('data-attachment-id', file.attachmentId);

    if (file.size != null) {
      $div.attr('data-attachment-size', String(file.size));
    }

    return $div;
  }

  private buildPdfNode(
    $: CheerioAPI,
    file: ResolvedFile,
    opts: { name?: string; width?: string; height?: string } = {},
  ) {
    const $pdf = $('<div>')
      .attr('data-type', 'pdf')
      .attr('src', file.apiFilePath)
      .attr('data-attachment-id', file.attachmentId)
      .attr('data-name', opts.name || file.fileName)
      .attr('width', opts.width || '800')
      .attr('height', opts.height || '600');

    if (file.size != null) {
      $pdf.attr('data-size', String(file.size));
    }

    return $pdf;
  }

  private buildVideoNode(
    $: CheerioAPI,
    file: ResolvedFile,
    opts: { width?: string; align?: string } = {},
  ) {
    return $('<video>')
      .attr('src', file.apiFilePath)
      .attr('data-attachment-id', file.attachmentId)
      .attr('width', opts.width || '100%')
      .attr('data-align', opts.align || 'center');
  }

  private buildAudioNode($: CheerioAPI, file: ResolvedFile) {
    return $('<audio>')
      .attr('src', file.apiFilePath)
      .attr('data-attachment-id', file.attachmentId);
  }

  private buildDrawioNode(
    $: CheerioAPI,
    drawio: { attachmentId: string; apiFilePath: string },
    opts: {
      type?: 'drawio' | 'excalidraw';
      title?: string;
      width?: string;
      align?: string;
    } = {},
  ) {
    return $('<div>')
      .attr('data-type', opts.type || 'drawio')
      .attr('data-src', drawio.apiFilePath)
      .attr('data-title', opts.title || 'diagram')
      .attr('data-width', opts.width || '100%')
      .attr('data-align', opts.align || 'center')
      .attr('data-attachment-id', drawio.attachmentId);
  }

  /**
   * Dispatches to the correct node builder based on the resolved file's
   * extension/mimeType. Used for anchors and embedded objects/iframes,
   * where the target could be any attachment type.
   */
  private buildNodeForFile(
    $: CheerioAPI,
    file: ResolvedFile,
    opts: { name?: string; width?: string; height?: string; align?: string } = {},
  ) {
    const ext = path.extname(file.fileName).toLowerCase();

    if (ext === '.pdf' || file.mimeType === 'application/pdf') {
      return this.buildPdfNode($, file, opts);
    }
    if (ext === '.mp4') {
      return this.buildVideoNode($, file, opts);
    }
    if (AUDIO_EXTENSIONS.has(ext)) {
      return this.buildAudioNode($, file);
    }
    return this.buildAttachmentNode($, file, opts.name);
  }

  async processAttachments(opts: {
    html: string;
    pageRelativePath?: string;
    extractDir?: string;
    pageId: string;
    fileTask: FileTask | {workspaceId: string, spaceId: string, creatorId: string};
    attachmentCandidates?: Map<string, string>;
    pageAttachments?: AttachmentInfo[];
    isConfluenceImport?: boolean;
  }): Promise<string> {
    const {
      html,
      pageRelativePath,
      extractDir,
      pageId,
      fileTask,
      attachmentCandidates = new Map(),
      pageAttachments = [],
      isConfluenceImport,
    } = opts;

    const attachmentTasks: (() => Promise<void>)[] = [];
    const limit = pLimit(this.CONCURRENT_UPLOADS);
    const uploadStats: UploadStats = {
      total: 0,
      completed: 0,
      failed: 0,
      failedFiles: [],
    };

    // Analyze attachments to identify Draw.io pairs
    const { drawioPairs, skipFiles } = this.analyzeAttachments(
      pageAttachments,
      isConfluenceImport,
    );

    // Map to store processed Draw.io SVGs
    const drawioSvgMap = new Map<
      string,
      {
        attachmentId: string;
        apiFilePath: string;
        fileName: string;
      }
    >();

    //this.logger.debug(`Found ${drawioPairs.size} Draw.io pairs to process`);

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
            await this.storageService.uploadStream(storageFilePath, stream, {
              recreateClient: true,
            });

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

    // Build a map from resolved archive path → real filename from Confluence
    // metadata. Confluence Server archives often store files under numeric IDs
    // (e.g. "attachments/65601/65602") instead of the original filename.
    // Also register aliases so HTML references using the original filename
    // (e.g. "attachments/pageId/original.mp3") resolve to the numeric path.
    const pageDir = path.dirname(pageRelativePath);
    const attachmentNameByRelPath = new Map<string, string>();
    for (const attachment of pageAttachments) {
      const relPath = resolveRelativeAttachmentPath(
        attachment.href,
        pageDir,
        attachmentCandidates,
      );
      if (relPath && attachment.fileName) {
        attachmentNameByRelPath.set(relPath, attachment.fileName);

        const dir = path.posix.dirname(relPath);
        const aliasKey = `${dir}/${attachment.fileName}`;
        if (!attachmentCandidates.has(aliasKey)) {
          attachmentCandidates.set(aliasKey, attachmentCandidates.get(relPath)!);
          attachmentNameByRelPath.set(aliasKey, attachment.fileName);
        }
      }
    }

    /**
     * Cache keyed by the *relative* path that appears in the HTML. Ensures
     * we upload (and DB-insert) each on-disk attachment at most once, even
     * if it's referenced multiple times on the page.
     */
    const relativeCache = new Map<string, ResolvedFile>();

    const uploadRelativeFile = (relPath: string): ResolvedFile => {
      const abs = attachmentCandidates.get(relPath)!;
      const attachmentId = v7();

      const realName = attachmentNameByRelPath.get(relPath);
      const baseName = realName || path.basename(abs);
      const ext = path.extname(baseName);

      const fileName =
        sanitizeFileName(path.basename(baseName, ext)) + ext.toLowerCase();

      const storageFilePath = `${getAttachmentFolderPath(
        AttachmentType.File,
        fileTask.workspaceId,
      )}/${attachmentId}/${fileName}`;
      const apiFilePath = `/api/files/${attachmentId}/${fileName}`;

      attachmentTasks.push(() =>
        this.uploadWithRetry({
          abs,
          storageFilePath,
          attachmentId,
          fileName,
          ext,
          pageId,
          fileTask,
          uploadStats,
        }),
      );

      return {
        attachmentId,
        apiFilePath,
        fileName,
        mimeType: getMimeType(fileName),
        abs,
      };
    };

    /**
     * – Returns cached data if we’ve already processed this path.
     * – Otherwise calls `uploadRelativeFile`, stores the result, and returns it.
     */
    const resolveRelativeFile = (relPath: string): ResolvedFile => {
      const cached = relativeCache.get(relPath);
      if (cached) return cached;

      const fresh = uploadRelativeFile(relPath);
      relativeCache.set(relPath, fresh);
      return fresh;
    };

    /**
     * Cache keyed by mimeType + decoded payload. Ensures we upload (and
     * DB-insert) each embedded attachment at most once, even if it's
     * referenced multiple times on the page.
     */
    const embeddedCache = new Map<string, ResolvedFile | null>();

    const resolveEmbeddedFile = (uri: string): ResolvedFile | null => {
      const parsed = this.parseDataUri(uri);
      if (!parsed) return null;

      const { buffer, mimeType, fileExt, encoded } = parsed;
      const cacheKey = `${mimeType}:${encoded}`;
      if (embeddedCache.has(cacheKey)) {
        return embeddedCache.get(cacheKey);
      }

      const attachmentId = v7();
      const fileName = `${attachmentId}${fileExt}`;
      const storageFilePath = `${getAttachmentFolderPath(
        AttachmentType.File,
        fileTask.workspaceId,
      )}/${attachmentId}/${fileName}`;
      const apiFilePath = `/api/files/${attachmentId}/${fileName}`;

      attachmentTasks.push(() =>
        this.uploadWithRetry({
          buffer,
          mimeType,
          storageFilePath,
          attachmentId,
          fileName,
          ext: fileExt,
          pageId,
          fileTask,
          uploadStats,
        }),
      );

      const result = {
        attachmentId,
        apiFilePath,
        fileName,
        mimeType,
        size: buffer.length,
        buffer,
      };
      embeddedCache.set(cacheKey, result);
      return {
        attachmentId,
        apiFilePath,
        fileName,
        mimeType,
        size: buffer.length,
        buffer,
      };
    };

    const resolveSource = (raw?: string): ResolvedFile | null => {
      const src = raw?.trim()
      if (src.toLowerCase().startsWith('data:')) {
        return resolveEmbeddedFile(src);
      }
      
      const url = cleanUrlString(src ?? '');
      if (!url || url.startsWith('http')) return null;

      const relPath = resolveRelativeAttachmentPath(
        url,
        pageDir,
        attachmentCandidates,
      );
      if (!relPath) return null;
      return resolveRelativeFile(relPath);
    };

    const resolveRelPath = (raw?: string): string | null => {
      const value = cleanUrlString(raw ?? '').trim();
      if (
        !value ||
        value.startsWith('http') ||
        value.toLowerCase().startsWith('data:')
      ) {
        return null;
      }
      return resolveRelativeAttachmentPath(
        value,
        pageDir,
        attachmentCandidates,
      );
    };

    const $ = load(html);

    // image
    for (const imgEl of $('img').toArray()) {
      const $img = $(imgEl);
      const raw = $img.attr('src');

      // Check if this image is part of a Draw.io pair
      const relPath = resolveRelPath(raw);
      if (relPath) {
        const drawioSvg = drawioSvgMap.get(relPath);
        if (drawioSvg) {
          const $drawio = this.buildDrawioNode($, drawioSvg);
          $img.replaceWith($drawio);
          unwrapFromParagraph($, $drawio);
          continue;
        }
      }

      const file = resolveSource(raw);
      if (!file) continue;

      let width = $img.attr('width');
      const height = $img.attr('height');
      const align = $img.attr('data-align') ?? 'center';

      if (!width) {
        try {
          const buf = file.abs ? await fs.readFile(file.abs) : file.buffer;
          const natural = imageDimensionsFromData(new Uint8Array(buf));
          if (natural) {
            width = height
              ? String(
                  Math.round((natural.width / natural.height) * Number(height)),
                )
              : String(natural.width);
          }
        } catch {
          /* empty */
        }

        if (!width) {
          width = '600';
        }
      }

      $img
        .attr('src', file.apiFilePath)
        .attr('data-attachment-id', file.attachmentId)
        .attr('width', width)
        .attr('height', height)
        .attr('data-align', align);

      unwrapFromParagraph($, $img);
    }

    // video
    for (const vidEl of $('video').toArray()) {
      const $vid = $(vidEl);
      const file = resolveSource($vid.attr('src'));
      if (!file) continue;

      const width = $vid.attr('width') ?? '100%';
      const align = $vid.attr('data-align') ?? 'center';

      $vid
        .attr('src', file.apiFilePath)
        .attr('data-attachment-id', file.attachmentId)
        .attr('width', width)
        .attr('data-align', align);

      unwrapFromParagraph($, $vid);
    }

    // audio
    for (const audEl of $('audio').toArray()) {
      const $aud = $(audEl);
      const file = resolveSource($aud.attr('src'));
      if (!file) continue;

      $aud
        .attr('src', file.apiFilePath)
        .attr('data-attachment-id', file.attachmentId);

      unwrapFromParagraph($, $aud);
    }

    // <div data-type="attachment">
    for (const el of $('div[data-type="attachment"]').toArray()) {
      const $oldDiv = $(el);
      const file = resolveSource($oldDiv.attr('data-attachment-url'));
      if (!file) continue;

      const $newDiv = this.buildAttachmentNode($, file);

      $oldDiv.replaceWith($newDiv);
      unwrapFromParagraph($, $newDiv);
    }

    // rewrite other attachments via <a>
    for (const aEl of $('a').toArray()) {
      const $a = $(aEl);
      const raw = $a.attr('href');
      const relPath = resolveRelPath(raw);

      if (relPath) {
        // Check if this is a Draw.io file
        const drawioSvg = drawioSvgMap.get(relPath);
        if (drawioSvg) {
          const $drawio = this.buildDrawioNode($, drawioSvg);
          $a.replaceWith($drawio);
          unwrapFromParagraph($, $drawio);
          continue;
        }

        // Skip files that should be ignored
        if (skipFiles.has(relPath)) {
          $a.remove();
          continue;
        }
      }

      const file = resolveSource(raw);
      if (!file) continue;
      const confAliasName = $a.attr('data-linked-resource-default-alias');
      const $node = this.buildNodeForFile($, file, {
        name: confAliasName || undefined,
      });

      $a.replaceWith($node);
      unwrapFromParagraph($, $node);
    }

    // rewrite iframe, object and embed elements
    for (const el of $('object[data], embed[src], iframe[src]').toArray()){
      const $el = $(el);
      const src = $el.is('object') ? 'data' : 'src';
      const file = resolveSource($el.attr(src))
      if (!file) continue;

      const confAliasName = $el.attr('data-linked-resource-default-alias');
      const $node = this.buildNodeForFile($, file, {
        name: confAliasName || undefined,
      });

      $el.replaceWith($node);
      unwrapFromParagraph($, $node);
    }

    // excalidraw and drawio
    for (const type of ['excalidraw', 'drawio'] as const) {
      for (const el of $(`div[data-type="${type}"]`).toArray()) {
        const $oldDiv = $(el);
        const file = resolveSource($oldDiv.attr('data-src'));
        if (!file) continue;

        const $newDiv = this.buildDrawioNode($, file, {
          type,
          title: file.fileName,
          width: $oldDiv.attr('data-width') || '600',
          align: $oldDiv.attr('data-align') || 'center',
        });

        $oldDiv.replaceWith($newDiv);
        unwrapFromParagraph($, $newDiv);
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

      const $drawio = this.buildDrawioNode($, drawioSvg, { width: '600' });
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

      // Resolve the metadata href to the actual archive path
      const resolvedHref = resolveRelativeAttachmentPath(
        href,
        pageDir,
        attachmentCandidates,
      );
      if (!resolvedHref) continue;

      // Check if already processed (was referenced in HTML).
      // Inline elements may have been processed under an alias key (original
      // filename) rather than the numeric archive path, so also check whether
      // the underlying absolute file path has already been uploaded.
      const absPath = attachmentCandidates.get(resolvedHref);
      const alreadyProcessed =
        relativeCache.has(resolvedHref) ||
        (absPath &&
          Array.from(relativeCache.values()).some(
            (entry) => entry.abs === absPath,
          ));
      if (alreadyProcessed) {
        continue;
      }

      // This attachment was in the list but not referenced in HTML - add it
      const file = resolveRelativeFile(resolvedHref);

      // Add as attachment node at the end
      const $attachmentDiv = this.buildAttachmentNode(
        $,
        { ...file, mimeType: mimeType || file.mimeType },
        fileName,
      );

      $.root().append($attachmentDiv);
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

    // Post-process DOM elements to add file sizes after uploads complete
    // This avoids blocking file operations during initial DOM processing
    // Embedded (`data:` URI) attachments already
    // know their size up front, so the builders set it immediately and
    // those elements are excluded by the selector below.
    const elementsNeedingSize = $(
      '[data-attachment-id]:not([data-attachment-size]):not([data-size])',
    );
    for (const element of elementsNeedingSize.toArray()) {
      const $el = $(element);
      const attachmentId = $el.attr('data-attachment-id');
      if (!attachmentId) continue;

      // Find the corresponding processed file info
      const processedEntry = Array.from(relativeCache.values()).find(
        (entry) => entry.attachmentId === attachmentId,
      );
      if (!processedEntry?.abs) continue;

      try {
        const stat = await fs.stat(processedEntry.abs);
        const sizeStr = stat.size.toString();
        const tagName = $el.prop('tagName')?.toLowerCase();
        // audio and pdf nodes use data-size, attachment nodes use data-attachment-size
        if (tagName === 'audio' || $el.attr('data-type') === 'pdf') {
          $el.attr('data-size', sizeStr);
        } else {
          $el.attr('data-attachment-size', sizeStr);
        }
      } catch (error) {
        this.logger.debug(
          `Could not get size for ${processedEntry.abs}:`,
          error,
        );
      }
    }

    return $.root().html() || '';
  }

  private analyzeAttachments(
    attachments: AttachmentInfo[],
    isConfluenceImport?: boolean,
  ): {
    drawioPairs: Map<string, DrawioPair>;
    skipFiles: Set<string>;
  } {
    const drawioPairs = new Map<string, DrawioPair>();
    const skipFiles = new Set<string>();

    if (!isConfluenceImport) {
      return { drawioPairs, skipFiles };
    }

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
          //Skipped non-Draw.io file with mxfile MIME.
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
    abs?: string;
    buffer?: Buffer;
    mimeType?: string;
    storageFilePath: string;
    attachmentId: string;
    fileName: string;
    ext: string;
    pageId: string;
    fileTask: FileTask | {workspaceId: string, spaceId: string, creatorId: string};
    uploadStats: UploadStats;
  }): Promise<void> {
    const {
      abs,
      buffer,
      mimeType,
      storageFilePath,
      attachmentId,
      fileName,
      ext,
      pageId,
      fileTask,
      uploadStats,
    } = opts;

    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const fileStream = abs ? createReadStream(abs) : Readable.from(buffer);
        await this.storageService.uploadStream(storageFilePath, fileStream, {
          recreateClient: true,
        });

        const fileSize = abs ? (await fs.stat(abs)).size : buffer.length;

        await this.db
          .insertInto('attachments')
          .values({
            id: attachmentId,
            filePath: storageFilePath,
            fileName,
            fileSize,
            mimeType: mimeType ?? getMimeType(fileName),
            type: 'file',
            fileExt: ext,
            creatorId: fileTask.creatorId,
            workspaceId: fileTask.workspaceId,
            pageId,
            spaceId: fileTask.spaceId,
          })
          .execute();

        // Queue PDF and DOCX files for indexing
        const supportedExtensions = ['.pdf', '.docx'];
        if (supportedExtensions.includes(ext.toLowerCase())) {
          try {
            await this.attachmentQueue.add(
              QueueJob.ATTACHMENT_INDEX_CONTENT,
              { attachmentId },
              {
                attempts: 1,
                backoff: {
                  type: 'exponential',
                  delay: 3 * 60 * 1000,
                },
                deduplication: {
                  id: attachmentId,
                },
                removeOnComplete: true,
                removeOnFail: false,
              },
            );
            this.logger.debug(
              `Queued ${fileName} for indexing (attachment ID: ${attachmentId})`,
            );
          } catch (err) {
            this.logger.error(
              `Failed to queue indexing for imported attachment ${attachmentId}: ${err}`,
            );
          }
        }

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
          `Upload attempt ${attempt}/${this.MAX_RETRIES} failed for ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
        );

        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.RETRY_DELAY * attempt),
          );
        }
      }
    }

    uploadStats.failed++;
    uploadStats.failedFiles.push(fileName);
    this.logger.error(
      `Failed to upload ${fileName} after ${this.MAX_RETRIES} attempts:`,
      lastError,
    );
  }

  /**
   * Parses and validates a `data:` URI, returning the decoded buffer and
   * file metadata. Returns `null` for anything unsupported or malformed.
   */
  private parseDataUri(
    uri: string,
  ): { buffer: Buffer; mimeType: string; fileExt: string; encoded: string } | null {
    const commaIndex = uri.indexOf(',');
    if (commaIndex === -1) return null;

    const metadata = uri.slice(5, commaIndex);
    const metadataParts = metadata.split(';');
    const mimeType = metadataParts.shift()?.trim().toLowerCase();
    const isBase64Payload = metadataParts.some(
      (part) => part.trim().toLowerCase() === 'base64',
    );

    if (!mimeType || !isBase64Payload) {
      return null;
    }

    const fileExt = resolveExtensionForMimeType(mimeType);
    if (!fileExt) {
      this.logger.warn(`Skipping malformed embedded ${mimeType} payload`);
      return null;
    }

    let encoded: string;
    try {
      encoded = decodeURIComponent(uri.slice(commaIndex + 1)).replace(
        /\s/g,
        '',
      );
    } catch {
      this.logger.warn(`Skipping malformed embedded ${mimeType} payload`);
      return null;
    }

    if (!isBase64(encoded)) {
      this.logger.warn(`Skipping malformed embedded ${mimeType} payload`);
      return null;
    }

    const maxFileSize = bytes(this.environmentService.getFileUploadSizeLimit());

    // before allocating a buffer to decode, reject obviously oversized
    // payloads based on the estimated decoded size
    const estimatedSize = Math.floor(encoded.length * 0.75);
    if (estimatedSize > maxFileSize) {
      this.logger.warn(
        `Skipping embedded ${mimeType} payload exceeding size limit (${estimatedSize} bytes)`,
      );
      return null;
    }

    const buffer = Buffer.from(encoded, 'base64');
    if (buffer.length === 0) return null;
    if (buffer.length > maxFileSize) {
      this.logger.warn(
        `Skipping embedded ${mimeType} payload exceeding size limit (${buffer.length} bytes)`,
      );
      return null;
    }

    return { buffer, mimeType, fileExt, encoded };
  }
}
