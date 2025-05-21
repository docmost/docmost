import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { MultipartFile } from '@fastify/multipart';
import { sanitize } from 'sanitize-filename-ts';
import * as path from 'path';
import {
  htmlToJson,
  jsonToText,
  tiptapExtensions,
} from '../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateSlugId } from '../../common/helpers';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { markdownToHtml } from '@docmost/editor-ext';
import {
  FileTaskStatus,
  FileTaskType,
  getFileTaskFolderPath,
} from './file.utils';
import { v7 as uuid7 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../queue/constants';

@Injectable()
export class FileTaskService {
  private readonly logger = new Logger(FileTaskService.name);

  constructor(
    private readonly storageService: StorageService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async processZIpImport(fileTaskId: string): Promise<void> {
    console.log(`Processing zip import: ${fileTaskId}`);

    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', fileTaskId)
      .executeTakeFirst();

    if (!fileTask) {
      this.logger.log(`File task with ID ${fileTaskId} not found`);
      return;
    }

    // update status to processing
    await this.db
      .updateTable('fileTasks')
      .set({ status: FileTaskStatus.Processing })
      .execute();

    // it did, what next?
    const file = await this.storageService.read(fileTask.filePath);


  }

  // receive the file
  async processGenericImport(fileTaskId: string): Promise<void> {

  }
}
