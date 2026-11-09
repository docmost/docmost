import { Module } from '@nestjs/common';
import { DocumentCollaborationController } from './document-collaboration.controller';
import { DocumentCollaborationService } from './document-collaboration.service';
import { DocumentCollaborationRepo } from './document-collaboration.repo';
import { CollaborationOutboxService } from './collaboration-outbox.service';

@Module({
  controllers: [DocumentCollaborationController],
  providers: [
    DocumentCollaborationRepo,
    DocumentCollaborationService,
    CollaborationOutboxService,
  ],
})
export class DocumentCollaborationModule {}
