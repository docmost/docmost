import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { WatcherController } from './watcher.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [CaslModule],
  controllers: [WatcherController],
  providers: [WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
