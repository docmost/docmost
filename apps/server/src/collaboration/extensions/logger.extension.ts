import {
  Extension,
  onDisconnectPayload,
  onLoadDocumentPayload,
} from '@hocuspocus/server';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerExtension implements Extension {
  private readonly logger = new Logger('Collab' + LoggerExtension.name);

  async afterUnloadDocument(data: onLoadDocumentPayload) {
    this.logger.debug('Unloaded ' + data.documentName + ' from memory');
  }

  async onDisconnect(data: onDisconnectPayload) {
    this.logger.debug('User disconnected from ' + data.documentName);
  }
}
