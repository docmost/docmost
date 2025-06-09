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
} from '../utils/import.utils';
import { executeTx } from '@docmost/db/utils';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { ImportAttachmentService } from './import-attachment.service';
import { ModuleRef } from '@nestjs/core';
import { PageService } from '../../../core/page/services/page.service';
import { ImportPageNode } from '../dto/file-task-dto';

@Injectable()
export class FileTaskService {
  private readonly logger = new Logger(FileTaskService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly importService: ImportService,
    private readonly pageService: PageService,
    private readonly backlinkRepo: BacklinkRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly importAttachmentService: ImportAttachmentService,
    private moduleRef: ModuleRef,
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

    const pageResults = await Promise.all(
      Array.from(pagesMap.values()).map(async (page) => {
        const htmlContent =
          await this.importAttachmentService.processAttachments({
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
