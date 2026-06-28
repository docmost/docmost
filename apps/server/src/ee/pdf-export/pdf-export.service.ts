import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { TokenService } from '../../core/auth/services/token.service';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { getProsemirrorContent } from '../../common/helpers/prosemirror/utils';
import {
  FileTaskStatus,
  FileTaskType,
} from '../../integrations/import/utils/file.utils';
import { StorageService } from '../../integrations/storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { v7 as uuid7 } from 'uuid';
import { Readable } from 'stream';

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly tokenService: TokenService,
    private readonly storageService: StorageService,
    @InjectQueue(QueueName.FILE_TASK_QUEUE)
    private readonly fileTaskQueue: Queue,
  ) {}

  async getRenderPayload(pageId: string, token: string) {
    const payload = await this.tokenService.verifyJwt(
      token,
      JwtType.PDF_RENDER,
    );
    if (payload.pageId !== pageId) {
      throw new UnauthorizedException('Invalid render token');
    }

    const page = await this.pageRepo.findById(pageId, { includeContent: true });
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    return {
      pageId: page.id,
      title: page.title,
      content: getProsemirrorContent(page.content),
    };
  }

  async generateAndStorePdf(fileTaskId: string): Promise<void> {
    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', fileTaskId)
      .executeTakeFirst();

    if (!fileTask?.pageId) {
      await this.markFailed(fileTaskId, 'Missing page for PDF export');
      return;
    }

    const page = await this.pageRepo.findById(fileTask.pageId, {
      includeContent: true,
    });
    if (!page) {
      await this.markFailed(fileTaskId, 'Page not found');
      return;
    }

    const text = `${page.title || 'Untitled'}\n\n${page.textContent || ''}`;
    const buffer = Buffer.from(text, 'utf8');
    await this.storageService.upload(fileTask.filePath, Readable.from(buffer));

    await this.db
      .updateTable('fileTasks')
      .set({
        status: FileTaskStatus.Success,
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where('id', '=', fileTaskId)
      .execute();
  }

  async cleanupExpiredExports(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const tasks = await this.db
      .selectFrom('fileTasks')
      .select(['id', 'filePath'])
      .where('type', '=', FileTaskType.Export)
      .where('createdAt', '<', cutoff)
      .execute();

    for (const task of tasks) {
      try {
        if (task.filePath) {
          await this.storageService.delete(task.filePath);
        }
      } catch (err) {
        this.logger.debug(`Failed to delete export file ${task.filePath}`);
      }
      await this.db
        .updateTable('fileTasks')
        .set({ deletedAt: new Date() })
        .where('id', '=', task.id)
        .execute();
    }
  }

  async queuePageExport(
    pageId: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ fileTaskId: string }> {
    const fileTaskId = uuid7();
    const filePath = `${workspaceId}/exports/${fileTaskId}/export.pdf`;

    await this.db
      .insertInto('fileTasks')
      .values({
        id: fileTaskId,
        type: FileTaskType.Export,
        fileName: 'export.pdf',
        filePath,
        fileExt: '.pdf',
        pageId,
        creatorId: userId,
        workspaceId,
        status: FileTaskStatus.Processing,
      })
      .execute();

    await this.fileTaskQueue.add(QueueJob.PDF_EXPORT_TASK, { fileTaskId });

    return { fileTaskId };
  }

  private async markFailed(fileTaskId: string, message: string) {
    await this.db
      .updateTable('fileTasks')
      .set({
        status: FileTaskStatus.Failed,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where('id', '=', fileTaskId)
      .execute();
  }
}
