import { KyselyDB } from '@docmost/db/types/kysely.types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { CreateSyncPageDto } from '../dto/create-sync-page.dto';
import { Page, SynchronizedPage } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { executeTx } from '@docmost/db/utils';
import { generateSlugId } from 'src/common/helpers';
import { PageService } from './page.service';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';

@Injectable()
export class SynchronizedPageService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly syncPageRepo: SynchronizedPageRepo,
  ) {}

  async create(
    createPageDto: CreateSyncPageDto,
    userId: string,
    workspaceId: string,
  ): Promise<Page> {
    const originPage = await this.pageRepo.findById(createPageDto.originPageId);

    let parentPageId = undefined;

    if (createPageDto.parentPageId) {
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
      );

      if (!parentPage || parentPage.spaceId !== createPageDto.spaceId) {
        throw new NotFoundException('Parent page not found');
      }

      parentPageId = parentPage.id;
    }

    const createdPage = await executeTx<Page>(this.db, async (trx) => {
      const refPage = await this.pageRepo.insertPage(
        {
          slugId: generateSlugId(),
          title: originPage.title + ' Sync',
          position: await this.pageService.nextPagePosition(
            createPageDto.spaceId,
            parentPageId,
          ),
          icon: originPage.icon,
          parentPageId: parentPageId,
          spaceId: createPageDto.spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
          isSynced: true,
        },
        trx,
      );

      Logger.debug(
        `Created page with id ${refPage.id}`,
        'SynchronizedPageService',
      );

      await this.syncPageRepo.insert(
        {
          originPageId: originPage.id,
          referencePageId: refPage.id,
        },
        trx,
      );

      return refPage;
    });

    return createdPage;
  }

  async findByReferenceId(pageId: string): Promise<SynchronizedPage> {
    return await this.syncPageRepo.findByReferencePageId(pageId);
  }
}
