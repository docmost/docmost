import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { StorageService } from '../../integrations/storage/storage.service';
import mammoth from 'mammoth';

@Injectable()
export class AttachmentEeService {
  private readonly logger = new Logger(AttachmentEeService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly storageService: StorageService,
  ) {}

  async indexAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) return;

    try {
      const buffer = await this.storageService.read(attachment.filePath);
      let textContent = '';

      if (attachment.fileExt.toLowerCase() === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      } else if (attachment.fileExt.toLowerCase() === '.pdf') {
        textContent = buffer.toString('utf8', 0, Math.min(buffer.length, 8192));
      }

      if (textContent.trim()) {
        await this.attachmentRepo.updateAttachment(
          { textContent: textContent.slice(0, 500_000) },
          attachmentId,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to index attachment ${attachmentId}: ${err}`);
    }
  }

  async indexAttachments(workspaceId: string): Promise<void> {
    const attachments = await this.db
      .selectFrom('attachments')
      .select('id')
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('fileExt', '=', '.pdf'),
          eb('fileExt', '=', '.docx'),
        ]),
      )
      .execute();

    for (const row of attachments) {
      await this.indexAttachment(row.id);
    }
  }
}
