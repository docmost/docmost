import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { PageRepository } from './repositories/page.repository';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PageOrderingService } from './services/page-ordering.service';
import { PageOrdering } from './entities/page-ordering.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, PageOrdering]),
    AuthModule,
    WorkspaceModule,
  ],
  controllers: [PageController],
  providers: [PageService, PageOrderingService, PageRepository],
  exports: [PageService, PageOrderingService, PageRepository],
})
export class PageModule {}
