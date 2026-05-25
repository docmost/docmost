import { Module } from '@nestjs/common';
import { DocopsServicesModule } from './services/services.module';

@Module({
  imports: [DocopsServicesModule],
  exports: [DocopsServicesModule],
})
export class DocopsModule {}
