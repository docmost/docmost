import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [CaslModule],
  controllers: [],
  providers: [WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
