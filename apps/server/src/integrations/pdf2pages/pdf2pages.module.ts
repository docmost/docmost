import { Module } from '@nestjs/common';

import { Pdf2PagesService } from './pdf2pages.service';
import { Pdf2PagesController } from './pdf2pages.controller';
import { PageService } from '../../core/page/services/page.service';
import { PersistenceExtension } from '../../collaboration/extensions/persistence.extension';

@Module({
  imports: [],
  providers: [Pdf2PagesService, PageService, PersistenceExtension],
  controllers: [Pdf2PagesController],
})
export class Pdf2PagesModule {}
