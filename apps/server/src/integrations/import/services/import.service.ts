import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { MultipartFile } from '@fastify/multipart';
import * as path from 'path';
import {
  htmlToJson,
  jsonToText,
  tiptapExtensions,
} from '../../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  bufferMultipartFile,
  generateSlugId,
  isUserDisabled,
  sanitizeFileName,
  streamMultipartFile,
} from '../../../common/helpers';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { markdownToHtml } from '@docmost/editor-ext';
import {
  FileTaskStatus,
  FileTaskType,
  getFileTaskFolderPath,
} from '../utils/file.utils';
import { v7 as uuid7 } from 'uuid';
import { StorageService } from '../../storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../queue/constants';
import { ModuleRef } from '@nestjs/core';
import { load } from 'cheerio';
import { normalizeImportHtml } from '../utils/import-formatter';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { HtmlBlockRepo } from '@docmost/db/repos/html-block/html-block.repo';
import { InsertablePage } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { LicenseCheckService } from '../../environment/license-check.service';
import { EnvironmentService } from '../../environment/environment.service';
import { Feature } from '../../../common/features';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';
import {
  canAuthorHtmlBlocks,
  convertImportedHtmlBlocks,
} from '../../../common/helpers/prosemirror/html-block.utils';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly storageService: StorageService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.FILE_TASK_QUEUE)
    private readonly fileTaskQueue: Queue,
    private moduleRef: ModuleRef,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly userRepo: UserRepo,
    private readonly htmlBlockRepo: HtmlBlockRepo,
    private readonly licenseCheckService: LicenseCheckService,
    private readonly eventEmitter: EventEmitter2,
    private readonly environmentService: EnvironmentService,
  ) {}

  async importPage(
    filePromise: Promise<MultipartFile>,
    userId: string,
    spaceId: string,
    workspaceId: string,
  ) {
    const file = await filePromise;
    const fileBuffer = await bufferMultipartFile(file);
    const fileExtension = path.extname(file.filename).toLowerCase();
    const fileName = sanitizeFileName(
      path.basename(file.filename, fileExtension),
    );
    const fileContent = fileBuffer.toString();

    let prosemirrorState = null;
    let createdPage = null;

    // For DOCX, we need the page ID upfront so images can reference it
    const pageId =
      fileExtension === '.docx' || fileExtension === '.pdf'
        ? uuid7()
        : undefined;

    try {
      if (fileExtension.endsWith('.md')) {
        prosemirrorState = await this.processMarkdown(fileContent);
      } else if (fileExtension.endsWith('.html')) {
        prosemirrorState = await this.processHTML(fileContent);
      } else if (fileExtension.endsWith('.docx')) {
        prosemirrorState = await this.processDocx(
          fileBuffer,
          workspaceId,
          spaceId,
          pageId,
          userId,
        );
      } else if (fileExtension.endsWith('.pdf')) {
        prosemirrorState = await this.processPdf(
          fileBuffer,
          workspaceId,
          spaceId,
          pageId,
          userId,
        );
      }
    } catch (err) {
      const message = 'Error processing file content';
      this.logger.error(message, err);
      throw new BadRequestException(message);
    }

    if (!prosemirrorState) {
      const message = 'Failed to create ProseMirror state';
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    const { title, prosemirrorJson } = this.extractTitleAndRemoveHeading(
      prosemirrorState,
      { anyHeadingLevel: true },
    );

    const pageTitle = title || fileName;

    if (prosemirrorJson) {
      try {
        const pagePosition = await this.getNewPagePosition(spaceId);
        const { json: content, blocks } = convertImportedHtmlBlocks(
          prosemirrorJson,
          {
            allowed: await this.canImportHtmlBlocks(userId, workspaceId),
            generateId: uuid7,
          },
        );

        const insertablePage: InsertablePage = {
          ...(pageId ? { id: pageId } : {}),
          slugId: generateSlugId(),
          title: pageTitle,
          content,
          textContent: jsonToText(content),
          ydoc: await this.createYdoc(content),
          position: pagePosition,
          spaceId: spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        };

        if (blocks.length === 0) {
          createdPage = await this.pageRepo.insertPage(insertablePage);
        } else {
          // not insertPage: it emits PAGE_CREATED, which must wait for the commit
          createdPage = await executeTx(this.db, async (trx) => {
            const { id } = await trx
              .insertInto('pages')
              .values(insertablePage)
              .returning('id')
              .executeTakeFirstOrThrow();
            await this.htmlBlockRepo.insertMany(
              blocks.map((block) => ({
                id: block.id,
                workspaceId,
                pageId: id,
                content: block.content,
                creatorId: userId,
              })),
              trx,
            );
            return this.pageRepo.findById(id, { trx });
          });
          this.eventEmitter.emit(EventName.PAGE_CREATED, {
            pageIds: [createdPage.id],
            workspaceId,
          });
        }

        this.logger.debug(
          `Successfully imported "${title}${fileExtension}. ID: ${createdPage.id} - SlugId: ${createdPage.slugId}"`,
        );
      } catch (err) {
        const message = 'Failed to create imported page';
        this.logger.error(message, err);
        throw new BadRequestException(message);
      }
    }

    return createdPage;
  }

  async canImportHtmlBlocks(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const [workspace, user] = await Promise.all([
      this.workspaceRepo.findById(workspaceId, { withLicenseKey: true }),
      this.userRepo.findById(userId, workspaceId),
    ]);
    if (!workspace || !user || isUserDisabled(user)) return false;

    return canAuthorHtmlBlocks({
      settings: workspace.settings,
      licensed: this.licenseCheckService.hasFeature(
        workspace.licenseKey,
        Feature.HTML_BLOCKS,
        workspace.plan,
      ),
      disabledOnServer: this.environmentService.isDisableHtmlBlocks(),
    });
  }

  async processMarkdown(markdownInput: string): Promise<any> {
    try {
      const html = await markdownToHtml(markdownInput);
      return this.processHTML(html);
    } catch (err) {
      throw err;
    }
  }

  async processHTML(htmlInput: string): Promise<any> {
    try {
      const $ = load(htmlInput);
      normalizeImportHtml($, $.root());
      return htmlToJson($.html() || '');
    } catch (err) {
      throw err;
    }
  }

  async processDocx(
    fileBuffer: Buffer,
    workspaceId: string,
    spaceId: string,
    pageId: string,
    userId: string,
  ): Promise<any> {
    let DocxImportModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DocxImportModule = require('./../../../ee/document-import/docx-import.service');
    } catch (err) {
      this.logger.error(
        'DOCX import requested but EE module not bundled in this build',
      );
      throw new BadRequestException(
        'This feature requires a valid enterprise license.',
      );
    }

    const docxImportService = this.moduleRef.get(
      DocxImportModule.DocxImportService,
      { strict: false },
    );

    const html = await docxImportService.convertDocxToHtml(
      fileBuffer,
      workspaceId,
      spaceId,
      pageId,
      userId,
    );

    return this.processHTML(html);
  }

  async processPdf(
    fileBuffer: Buffer,
    workspaceId: string,
    spaceId: string,
    pageId: string,
    userId: string,
  ): Promise<any> {
    let PdfImportModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      PdfImportModule = require('./../../../ee/document-import/pdf-import.service');
    } catch (err) {
      this.logger.error(
        'PDF import requested but EE module not bundled in this build',
      );
      throw new BadRequestException(
        'This feature requires a valid enterprise license.',
      );
    }

    const pdfImportService = this.moduleRef.get(
      PdfImportModule.PdfImportService,
      { strict: false },
    );

    const html = await pdfImportService.convertPdfToHtml(
      fileBuffer,
      workspaceId,
      spaceId,
      pageId,
      userId,
    );

    return this.processHTML(html);
  }

  async createYdoc(prosemirrorJson: any): Promise<Buffer | null> {
    if (prosemirrorJson) {
      // this.logger.debug(`Converting prosemirror json state to ydoc`);

      const ydoc = TiptapTransformer.toYdoc(
        prosemirrorJson,
        'default',
        tiptapExtensions,
      );

      Y.encodeStateAsUpdate(ydoc);

      return Buffer.from(Y.encodeStateAsUpdate(ydoc));
    }
    return null;
  }

  extractTitleAndRemoveHeading(
    prosemirrorState: any,
    opts?: { anyHeadingLevel?: boolean },
  ) {
    let title: string | null = null;

    const content = prosemirrorState.content ?? [];
    const firstNode = content[0];

    const isTitleHeading =
      firstNode?.type === 'heading' &&
      (opts?.anyHeadingLevel || firstNode.attrs?.level === 1);

    if (isTitleHeading) {
      const headingText = (firstNode.content ?? [])
        .map((node: any) => node.text ?? '')
        .join('')
        .trim();

      if (headingText) {
        title = headingText;
        content.shift();
      }
    }

    // ensure at least one paragraph
    if (content.length === 0) {
      content.push({
        type: 'paragraph',
        content: [],
      });
    }

    return {
      title,
      prosemirrorJson: {
        ...prosemirrorState,
        content,
      },
    };
  }

  async getNewPagePosition(
    spaceId: string,
    parentPageId?: string,
  ): Promise<string> {
    let query = this.db
      .selectFrom('pages')
      .select(['id', 'position'])
      .where('spaceId', '=', spaceId)
      .orderBy('position', (ob) => ob.collate('C').desc())
      .limit(1);

    if (parentPageId) {
      query = query.where('parentPageId', '=', parentPageId);
    } else {
      query = query.where('parentPageId', 'is', null);
    }

    const lastPage = await query.executeTakeFirst();

    if (lastPage) {
      return generateJitteredKeyBetween(lastPage.position, null);
    } else {
      return generateJitteredKeyBetween(null, null);
    }
  }

  async importZip(
    filePromise: Promise<MultipartFile>,
    source: string,
    userId: string,
    spaceId: string,
    workspaceId: string,
  ) {
    const file = await filePromise;
    const fileExtension = path.extname(file.filename).toLowerCase();
    const fileName = sanitizeFileName(
      path.basename(file.filename, fileExtension),
    );
    const fileNameWithExt = fileName + fileExtension;

    const fileTaskId = uuid7();
    const filePath = `${getFileTaskFolderPath(FileTaskType.Import, workspaceId)}/${fileTaskId}/${fileNameWithExt}`;

    // upload file
    const fileSize = await streamMultipartFile(file, (stream) =>
      this.storageService.upload(filePath, stream),
    );

    const fileTask = await this.db
      .insertInto('fileTasks')
      .values({
        id: fileTaskId,
        type: FileTaskType.Import,
        source: source,
        status: FileTaskStatus.Processing,
        fileName: fileNameWithExt,
        filePath: filePath,
        fileSize: fileSize,
        fileExt: 'zip',
        creatorId: userId,
        spaceId: spaceId,
        workspaceId: workspaceId,
      })
      .returningAll()
      .executeTakeFirst();

    await this.fileTaskQueue.add(QueueJob.IMPORT_TASK, {
      fileTaskId: fileTaskId,
    });

    return fileTask;
  }
}
