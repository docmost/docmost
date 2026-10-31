import { Global, Module } from '@nestjs/common';
import { CollabAccessService } from './services/collab-access.service.js';

@Global()
@Module({
  providers: [CollabAccessService],
  exports: [CollabAccessService],
})
export class CollabAccessModule {}
