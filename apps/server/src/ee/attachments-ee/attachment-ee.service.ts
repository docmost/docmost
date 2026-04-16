import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AttachmentEeService {
  private readonly logger = new Logger(AttachmentEeService.name);

  async indexAttachment(_attachmentId: string): Promise<void> {
    this.logger.debug('Attachment indexing requested in EE shim');
  }

  async indexAttachments(_workspaceId: string): Promise<void> {
    this.logger.debug('Bulk attachment indexing requested in EE shim');
  }
}
