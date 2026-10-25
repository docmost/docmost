import { Global, Module } from '@nestjs/common';
import { CollabAccessService } from './services/collab-access.service';

@Global()
@Module({
  providers: [CollabAccessService],
  exports: [CollabAccessService],
})
export class CollabAccessModule {}
