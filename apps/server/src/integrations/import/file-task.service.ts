import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { jsonToText } from '../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { extractZip, FileTaskStatus } from './file.utils';
import { StorageService } from '../storage/storage.service';
import * as tmp from 'tmp-promise';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { ImportService } from './import.service';
import { promises as fs } from 'fs';
import { generateSlugId } from '../../common/helpers';
import { v7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { FileTask, InsertablePage } from '@docmost/db/types/entity.types';

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

    // TODO: internal link mentions, backlinks, attachments
    try {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Processing);

      await this.processGenericImport({ extractDir: tmpExtractDir, fileTask });
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Success);
    } catch (error) {
      await this.updateTaskStatus(fileTaskId, FileTaskStatus.Failed);
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
      const content = await fs.readFile(absPath, 'utf-8');

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
        const pmState = await this.importService.markdownOrHtmlToProsemirror(
          page.content,
          page.fileExtension,
        );
        const { title, prosemirrorJson } =
          this.importService.extractTitleAndRemoveHeading(pmState);

        /*const rewDoc =
          await this.importService.convertInternalLinksToMentionsPM(
            jsonToNode(prosemirrorJson),
            page.filePath,
            filePathToPageMetaMap,
          );*/
        const proseJson = prosemirrorJson; //rewDoc.toJSON();

        return {
          id: page.id,
          slugId: page.slugId,
          title: title || page.name,
          content: proseJson,
          textContent: jsonToText(proseJson),
          ydoc: await this.importService.createYdoc(proseJson),
          position: page.position!,
          spaceId: fileTask.spaceId,
          workspaceId: fileTask.workspaceId,
          creatorId: fileTask.creatorId,
          lastUpdatedById: fileTask.creatorId,
          parentPageId: page.parentPageId,
        };
      }),
    );

    await this.db.insertInto('pages').values(insertablePages).execute();
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

  async updateTaskStatus(fileTaskId: string, status: FileTaskStatus) {
    await this.db
      .updateTable('fileTasks')
      .set({ status: status })
      .where('id', '=', fileTaskId)
      .execute();
  }
}
