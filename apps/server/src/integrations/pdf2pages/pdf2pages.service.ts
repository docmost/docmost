import {
  Injectable,
} from '@nestjs/common';
import { PageService } from '../../core/page/services/page.service';
import { Json } from '@docmost/db/types/db';
import { CreatePageDto } from '../../core/page/dto/create-page.dto';
import { PersistenceExtension } from '../../collaboration/extensions/persistence.extension';

@Injectable()
export class Pdf2PagesService {
  constructor(
    private readonly pageService: PageService,
    private readonly persistenceExtension: PersistenceExtension,
  ) {}
  async convertPdf2Pages(
    spaceId: string,
    userId: string,
    workspaceId: string,
    content: Json,
  ) {
    const createPageDto: CreatePageDto = { spaceId };
    const createdPage = await this.pageService.create(
      userId,
      workspaceId,
      createPageDto,
    );
    await this.persistenceExtension.updateContent(
      createdPage.id,
      userId,
      content,
    );
    return { statusCode: 'success', createdPage };
  }
}
