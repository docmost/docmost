import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { jsonToText } from '../../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  extractZip,
  FileImportSource,
  FileTaskStatus,
} from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import * as tmp from 'tmp-promise';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { ImportService } from './import.service';
import { promises as fs } from 'fs';
import { generateSlugId } from '../../../common/helpers';
import { v7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { FileTask, InsertablePage } from '@docmost/db/types/entity.types';
import { markdownToHtml } from '@docmost/editor-ext';
import { getProsemirrorContent } from '../../../common/helpers/prosemirror/utils';
import { formatImportHtml } from '../utils/import-formatter';
import {
  buildAttachmentCandidates,
  collectMarkdownAndHtmlFiles,
  stripNotionID,
} from '../utils/import.utils';
import { executeTx } from '@docmost/db/utils';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { ImportAttachmentService } from './import-attachment.service';
import { ModuleRef } from '@nestjs/core';
import { PageService } from '../../../core/page/services/page.service';
import { ImportPageNode } from '../dto/file-task-dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';

@Injectable()
export class FileImportTaskService {
  private readonly logger = new Logger(FileImportTaskService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly importService: ImportService,
    private readonly pageService: PageService,
    private readonly backlinkRepo: BacklinkRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly importAttachmentService: ImportAttachmentService,
    private moduleRef: ModuleRef,
    private eventEmitter: EventEmitter2,
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

    if (fileTask.status === FileTaskStatus.Failed) {
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

    try {
      const fileStream = await this.storageService.readStream(
        fileTask.filePath,
      );
      await pipeline(fileStream, createWriteStream(tmpZipPath));
      await extractZip(tmpZipPath, tmpExtractDir);
    } catch (err) {
      await cleanupTmpFile();
      await cleanupTmpDir();

      throw err;
    }

    try {
      if (
        fileTask.source === FileImportSource.Generic ||
        fileTask.source === FileImportSource.Notion
      ) {
        await this.processGenericImport({
          extractDir: tmpExtractDir,
          fileTask,
        });
      }

      if (fileTask.source === FileImportSource.Confluence) {
        let ConfluenceModule: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          ConfluenceModule = require('./../../../ee/confluence-import/confluence-import.service');
        } catch (err) {
          this.logger.error(
            'Confluence import requested but EE module not bundled in this build',
          );
          return;
        }
        const confluenceImportService = this.moduleRef.get(
          ConfluenceModule.ConfluenceImportService,
          { strict: false },
        );

        await confluenceImportService.processConfluenceImport({
          extractDir: tmpExtractDir,
          fileTask,
        });
      }
      try {
        await this.updateTaskStatus(fileTaskId, FileTaskStatus.Success, null);
        await cleanupTmpFile();
        await cleanupTmpDir();
        // delete stored file on success
        await this.storageService.delete(fileTask.filePath);
      } catch (err) {
        this.logger.error(
          `Failed to delete import file from storage. Task ID: ${fileTaskId}`,
          err,
        );
      }
    } catch (err) {
      await cleanupTmpFile();
      await cleanupTmpDir();

      throw err;
    }
  }

  async processGenericImport(opts: {
    extractDir: string;
    fileTask: FileTask;
  }): Promise<void> {
    const { extractDir, fileTask } = opts;
    const allFiles = await collectMarkdownAndHtmlFiles(extractDir);
    const attachmentCandidates = await buildAttachmentCandidates(extractDir);

    const pagesMap = new Map<string, ImportPageNode>();

    for (const absPath of allFiles) {
      const relPath = path
        .relative(extractDir, absPath)
        .split(path.sep)
        .join('/'); // normalize to forward-slashes
      const ext = path.extname(relPath).toLowerCase();

      pagesMap.set(relPath, {
        id: v7(),
        slugId: generateSlugId(),
        name: stripNotionID(path.basename(relPath, ext)),
        content: '',
        parentPageId: null,
        fileExtension: ext,
        filePath: relPath,
      });
    }

    // Create placeholder pages for folders without corresponding files
    const foldersWithContent = new Set<string>();

    pagesMap.forEach((page) => {
      const segments = page.filePath.split('/');
      segments.pop(); // remove filename

      // Build up all folder paths and mark them as having content
      let currentPath = '';
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        foldersWithContent.add(currentPath); // All ancestor folders have content
      }
    });

    // Determine if there's a single root container folder
    const rootLevelItems = new Set<string>();
    pagesMap.forEach((page) => {
      const firstSegment = page.filePath.split('/')[0];
      rootLevelItems.add(firstSegment);
    });

    // If all files are in a single root folder and no files at root level exist
    let skipRootFolder: string | null = null;
    if (rootLevelItems.size === 1) {
      const onlyRootItem = Array.from(rootLevelItems)[0];
      // Check if this is a folder (not a file at root)
      const hasRootFiles = Array.from(pagesMap.keys()).some(
        (filePath) => !filePath.includes('/'),
      );
      if (!hasRootFiles) {
        skipRootFolder = onlyRootItem;
      }
    }

    // For each folder with content, create a placeholder page if no corresponding .md or .html exists
    foldersWithContent.forEach((folderPath) => {
      if (folderPath.toLowerCase() === skipRootFolder.toLowerCase()) {
        return;
      }

      const mdPath = `${folderPath}.md`;
      const htmlPath = `${folderPath}.html`;

      if (!pagesMap.has(mdPath) && !pagesMap.has(htmlPath)) {
        const folderName = path.basename(folderPath);
        pagesMap.set(mdPath, {
          id: v7(),
          slugId: generateSlugId(),
          name: stripNotionID(folderName),
          content: '',
          parentPageId: null,
          fileExtension: '.md',
          filePath: mdPath,
        });
      }
    });

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
    const siblingsMap = new Map<string | null, ImportPageNode[]>();

    pagesMap.forEach((page) => {
      const group = siblingsMap.get(page.parentPageId) ?? [];
      group.push(page);
      siblingsMap.set(page.parentPageId, group);
    });

    // get root pages
    const rootSibs = siblingsMap.get(null);

    if (rootSibs?.length) {
      rootSibs.sort((a, b) => a.name.localeCompare(b.name));

      // get first position key from the server
      const nextPosition = await this.pageService.nextPagePosition(
        fileTask.spaceId,
      );

      let prevPos: string | null = null;
      rootSibs.forEach((page, idx) => {
        if (idx === 0) {
          page.position = nextPosition;
        } else {
          page.position = generateJitteredKeyBetween(prevPos, null);
        }
        prevPos = page.position;
      });
    }

    // non-root buckets (children & deeper levels)
    siblingsMap.forEach((sibs, parentId) => {
      if (parentId === null) return; // root already done

      sibs.sort((a, b) => a.name.localeCompare(b.name));

      let prevPos: string | null = null;
      for (const page of sibs) {
        page.position = generateJitteredKeyBetween(prevPos, null);
        prevPos = page.position;
      }
    });

    // internal page links
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

    // Group pages by level (topological sort for parent-child relationships)
    const pagesByLevel = new Map<number, Array<[string, ImportPageNode]>>();
    const pageLevel = new Map<string, number>();

    // Calculate levels using BFS
    const calculateLevels = () => {
      const queue: Array<{ filePath: string; level: number }> = [];

      // Start with root pages (no parent)
      for (const [filePath, page] of pagesMap.entries()) {
        if (!page.parentPageId) {
          queue.push({ filePath, level: 0 });
          pageLevel.set(filePath, 0);
        }
      }

      // BFS to assign levels
      while (queue.length > 0) {
        const { filePath, level } = queue.shift()!;
        const currentPage = pagesMap.get(filePath)!;

        // Find children of current page
        for (const [childFilePath, childPage] of pagesMap.entries()) {
          if (
            childPage.parentPageId === currentPage.id &&
            !pageLevel.has(childFilePath)
          ) {
            pageLevel.set(childFilePath, level + 1);
            queue.push({ filePath: childFilePath, level: level + 1 });
          }
        }
      }

      // Group pages by level
      for (const [filePath, page] of pagesMap.entries()) {
        const level = pageLevel.get(filePath) || 0;
        if (!pagesByLevel.has(level)) {
          pagesByLevel.set(level, []);
        }
        pagesByLevel.get(level)!.push([filePath, page]);
      }
    };

    calculateLevels();

    if (pagesMap.size < 1) return;

    // Process pages level by level sequentially to respect foreign key constraints
    const allBacklinks: any[] = [];
    const validPageIds = new Set<string>();
    let totalPagesProcessed = 0;

    // Sort levels to process in order
    const sortedLevels = Array.from(pagesByLevel.keys()).sort((a, b) => a - b);

    try {
      await executeTx(this.db, async (trx) => {
        // Process pages level by level sequentially within the transaction
        for (const level of sortedLevels) {
          const levelPages = pagesByLevel.get(level)!;

          for (const [filePath, page] of levelPages) {
            const absPath = path.join(extractDir, filePath);
            let content = '';

            // Check if file exists (placeholder pages won't have physical files)
            try {
              await fs.access(absPath);
              content = await fs.readFile(absPath, 'utf-8');

              if (page.fileExtension.toLowerCase() === '.md') {
                content = await markdownToHtml(content);
              }
            } catch (err: any) {
              if (err?.code === 'ENOENT') {
                // Use empty content, title will be the folder name
                content = '';
              } else {
                throw err;
              }
            }

            const htmlContent =
              await this.importAttachmentService.processAttachments({
                html: content,
                pageRelativePath: page.filePath,
                extractDir,
                pageId: page.id,
                fileTask,
                attachmentCandidates,
              });

            const { html, backlinks, pageIcon } = await formatImportHtml({
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
              icon: pageIcon || null,
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

            await trx.insertInto('pages').values(insertablePage).execute();

            // Track valid page IDs and collect backlinks
            validPageIds.add(insertablePage.id);
            allBacklinks.push(...backlinks);
            totalPagesProcessed++;

            // Log progress periodically
            if (totalPagesProcessed % 50 === 0) {
              this.logger.debug(`Processed ${totalPagesProcessed} pages...`);
            }
          }
        }

        const filteredBacklinks = allBacklinks.filter(
          ({ sourcePageId, targetPageId }) =>
            validPageIds.has(sourcePageId) && validPageIds.has(targetPageId),
        );

        // Insert backlinks in batches
        if (filteredBacklinks.length > 0) {
          const BACKLINK_BATCH_SIZE = 100;
          for (
            let i = 0;
            i < filteredBacklinks.length;
            i += BACKLINK_BATCH_SIZE
          ) {
            const backlinkChunk = filteredBacklinks.slice(
              i,
              Math.min(i + BACKLINK_BATCH_SIZE, filteredBacklinks.length),
            );
            await this.backlinkRepo.insertBacklink(backlinkChunk, trx);
          }
        }

        if (validPageIds.size > 0) {
          this.eventEmitter.emit(EventName.PAGE_CREATED, {
            pageIds: Array.from(validPageIds),
            workspaceId: fileTask.workspaceId,
          });
        }

        this.logger.log(
          `Successfully imported ${totalPagesProcessed} pages with ${filteredBacklinks.length} backlinks`,
        );
      });
    } catch (error) {
      this.logger.error('Failed to import files:', error);
      throw new Error(`File import failed: ${error?.['message']}`);
    }
  }

  async getFileTask(fileTaskId: string) {
    return this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', fileTaskId)
      .executeTakeFirst();
  }

  async updateTaskStatus(
    fileTaskId: string,
    status: FileTaskStatus,
    errorMessage?: string,
  ) {
    try {
      await this.db
        .updateTable('fileTasks')
        .set({ status: status, errorMessage, updatedAt: new Date() })
        .where('id', '=', fileTaskId)
        .execute();
    } catch (err) {
      this.logger.error(err);
    }
  }
}
