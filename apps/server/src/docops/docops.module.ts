import { Module } from '@nestjs/common';
import { DocopsServicesModule } from './services/services.module';
import { DocopsChangeRequestsModule } from './change-requests/change-requests.module';

@Module({
  imports: [DocopsServicesModule, DocopsChangeRequestsModule],
  exports: [DocopsServicesModule, DocopsChangeRequestsModule],
})
export class DocopsModule {}
