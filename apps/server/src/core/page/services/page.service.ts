import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Page, UpdatablePage } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  executeWithPagination,
  PaginationResult,
} from '@docmost/db/pagination/pagination';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { MovePageDto } from '../dto/move-page.dto';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { generateSlugId } from '../../../common/helpers';
import { calculateBlockHash, dbOrTx, executeTx } from '@docmost/db/utils';
import { PageMemberRepo } from '@docmost/db/repos/page/page-member.repo';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { SidebarPageDto, SidebarPageResultDto } from '../dto/sidebar-page.dto';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';
import { MyPageColorDto } from '../dto/update-color.dto';

@Injectable()
export class PageService {
  private readonly logger: Logger;

  constructor(
    private pageRepo: PageRepo,
    private pageMemberRepo: PageMemberRepo,
    private attachmentRepo: AttachmentRepo,
    private readonly syncPageRepo: SynchronizedPageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {
    this.logger = new Logger('PageService');
  }

  async findById(
    pageId: string,
    includeContent?: boolean,
    includeYdoc?: boolean,
    includeSpace?: boolean,
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, {
      includeContent,
      includeYdoc,
      includeSpace,
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    let parentPageId = undefined;

    // check if parent page exists
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
      const createdpage = await this.pageRepo.insertPage(
        {
          slugId: generateSlugId(),
          title: createPageDto.title,
          position: await this.nextPagePosition(
            createPageDto.spaceId,
            parentPageId,
          ),
          icon: createPageDto.icon,
          parentPageId: parentPageId,
          spaceId: createPageDto.spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        },
        trx,
      );

      await this.pageMemberRepo.insertPageMember(
        {
          userId: userId,
          pageId: createdpage.id,
          role: SpaceRole.ADMIN,
          addedById: userId,
        },
        trx,
      );

      return createdpage;
    });

    return createdPage;
  }

  async nextPagePosition(spaceId: string, parentPageId?: string) {
    let pagePosition: string;

    const lastPageQuery = this.db
      .selectFrom('pages')
      .select(['position'])
      .where('spaceId', '=', spaceId)
      .orderBy('position', 'desc')
      .limit(1);

    if (parentPageId) {
      // check for children of this page
      const lastPage = await lastPageQuery
        .where('parentPageId', '=', parentPageId)
        .executeTakeFirst();

      if (!lastPage) {
        pagePosition = generateJitteredKeyBetween(null, null);
      } else {
        // if there is an existing page, we should get a position below it
        pagePosition = generateJitteredKeyBetween(lastPage.position, null);
      }
    } else {
      // for root page
      const lastPage = await lastPageQuery
        .where('parentPageId', 'is', null)
        .executeTakeFirst();

      // if no existing page, make this the first
      if (!lastPage) {
        pagePosition = generateJitteredKeyBetween(null, null); // we expect "a0"
      } else {
        // if there is an existing page, we should get a position below it
        pagePosition = generateJitteredKeyBetween(lastPage.position, null);
      }
    }

    return pagePosition;
  }

  async update(
    page: Page,
    updatePageDto: UpdatePageDto,
    userId: string,
  ): Promise<Page> {
    const contributors = new Set<string>(page.contributorIds ?? []);
    contributors.add(userId);
    await this.pageRepo.updatePageMetadata(
      {
        title: updatePageDto.title,
        icon: updatePageDto.icon,
        lastUpdatedById: userId,
        updatedAt: new Date(),
        contributorIds: Array.from(contributors),
      },
      page.id,
    );

    return await this.pageRepo.findById(page.id, {
      includeSpace: true,
      includeContent: true,
      includeCreator: true,
      includeLastUpdatedBy: true,
      includeContributors: true,
    });
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
      .selectFrom('pages as child')
      .select((eb) =>
        eb
          .case()
          .when(eb.fn.countAll(), '>', 0)
          .then(true)
          .else(false)
          .end()
          .as('count'),
      )
      .whereRef('child.parentPageId', '=', 'pages.id')
      .limit(1)
      .as('hasChildren');
  }

  async getPagesInSpace(
    spaceId: string,
    pagination?: PaginationOptions,
    trx?: KyselyTransaction,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    const query = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'creatorId',
        'isSynced',
      ])
      .orderBy('position', 'asc')
      .where('spaceId', '=', spaceId);

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: 250,
    });

    return result;
  }

  async getSidebarPages(
    spaceId: string,
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    let query = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'creatorId',
        'isSynced',
      ])
      .select((eb) => this.withHasChildren(eb))
      .orderBy('position', 'asc')
      .where('spaceId', '=', spaceId);

    if (pageId) {
      query = query.where('parentPageId', '=', pageId);
    } else {
      query = query.where('parentPageId', 'is', null);
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: 250,
    });

    return result;
  }

  async movePageToSpace(rootPage: Page, spaceId: string) {
    await executeTx(this.db, async (trx) => {
      // Update root page
      const nextPosition = await this.nextPagePosition(spaceId);
      await this.pageRepo.updatePageMetadata(
        {
          spaceId,
          parentPageId: null,
          position: nextPosition,
          content: rootPage.content,
        },
        rootPage.id,
        trx,
      );
      const pageIds = await this.pageRepo
        .getPageAndDescendants(rootPage.id)
        .then((pages) => pages.map((page) => page.id));
      // The first id is the root page id
      if (pageIds.length > 1) {
        // Update sub pages
        await this.updatePages(
          { spaceId },
          pageIds.filter((id) => id !== rootPage.id),
          trx,
        );
      }
      // Update attachments
      await this.attachmentRepo.updateAttachmentsByPageId(
        { spaceId },
        pageIds,
        trx,
      );
    });
  }

  async updatePages(
    updatePageData: UpdatablePage,
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    for (const pageId of pageIds) {
      await this.updatePageWithContent(updatePageData, pageId, trx);
    }
  }

  async updatePageWithContent(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    this.logger.debug('Updating page: ', updatePageData);

    const pageUpdateResult = await this.pageRepo.updatePageMetadata(
      updatePageData,
      pageId,
      trx,
    );

    if (updatePageData.content) {
      await this.updatePageBlocks(updatePageData, pageId, trx);
    }

    return pageUpdateResult;
  }

  async updatePageBlocks(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const blocks: {
      attrs: { blockId: string };
      type?: string;
      content?: any[];
    }[] = (updatePageData?.content as any)?.content;

    if (!blocks || blocks.length === 0) {
      return;
    }

    const existingBlocks = await this.pageRepo.getExistingPageBlocks(
      pageId,
      trx,
    );

    const existingBlocksMap = new Map(
      existingBlocks.map((block) => [block.id, block]),
    );

    const incomingBlockIds = new Set(
      blocks.map((block) => {
        if (!Object.prototype.hasOwnProperty.call(block, 'attrs')) {
          this.logger.error('Block missing blockId attribute: ', block);
          return null;
        }
        if (!Object.prototype.hasOwnProperty.call(block.attrs, 'blockId')) {
          this.logger.error('Block missing blockId attribute: ', block);
          return null;
        }
        return block.attrs.blockId;
      }),
    );
    this.logger.debug('Incoming blocks: ', incomingBlockIds);

    const removedBlocks = existingBlocks.filter(
      (existingBlock) => !incomingBlockIds.has(existingBlock.id),
    );

    this.logger.debug('Deleting blocks: ', removedBlocks);
    for (const removedBlock of removedBlocks) {
      await this.pageRepo.deleteBlock(removedBlock.id, trx);
    }

    for (const block of blocks) {
      const blockId = block.attrs.blockId;
      const existingBlock = existingBlocksMap.get(blockId);
      const calculatedHash = calculateBlockHash(block);

      if (!existingBlock) {
        await this.pageRepo.createBlock(
          block,
          blockId,
          pageId,
          calculatedHash,
          trx,
        );
      } else if (existingBlock.stateHash !== calculatedHash) {
        await this.pageRepo.updateExistingBlock(
          block,
          blockId,
          calculatedHash,
          trx,
        );
      }
    }
  }

  async movePage(dto: MovePageDto, movedPage: Page) {
    // validate position value by attempting to generate a key
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    let parentPageId = null;
    if (movedPage.parentPageId === dto.parentPageId) {
      parentPageId = undefined;
    } else {
      // changing the page's parent
      if (dto.parentPageId) {
        const parentPage = await this.pageRepo.findById(dto.parentPageId);
        if (!parentPage || parentPage.spaceId !== movedPage.spaceId) {
          throw new NotFoundException('Parent page not found');
        }
        parentPageId = parentPage.id;
      }
    }

    await this.pageRepo.updatePageMetadata(
      {
        position: dto.position,
        parentPageId: parentPageId,
      },
      dto.pageId,
    );
  }

  async moveMyPage(
    dto: MovePageDto,
    movedPage: Page,
    userId: string,
  ): Promise<void> {
    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch (err) {
      throw new BadRequestException('Invalid move position');
    }

    if (dto.parentPageId) {
      const parentPage = await this.pageRepo.findById(dto.parentPageId);
      if (!parentPage) {
        throw new NotFoundException('Parent page not found');
      }

      if (parentPage.spaceId !== movedPage.spaceId) {
        throw new BadRequestException('Parent page must be in the same space');
      }

      if (parentPage.spaceId !== dto.personalSpaceId) {
        throw new BadRequestException();
      }
    }

    if (movedPage.spaceId !== dto.personalSpaceId && movedPage.parentPageId) {
      throw new BadRequestException();
    }

    return this.pageRepo.updateUserPagePreferences({
      position: dto.position,
      pageId: dto.pageId,
      userId: userId,
    });
  }

  async getPageBreadCrumbs(childPageId: string) {
    const ancestors = await this.db
      .withRecursive('page_ancestors', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
          ])
          .select((eb) => this.withHasChildren(eb))
          .where('id', '=', childPageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                'p.position',
                'p.parentPageId',
                'p.spaceId',
              ])
              .select(
                exp
                  .selectFrom('pages as child')
                  .select((eb) =>
                    eb
                      .case()
                      .when(eb.fn.countAll(), '>', 0)
                      .then(true)
                      .else(false)
                      .end()
                      .as('count'),
                  )
                  .whereRef('child.parentPageId', '=', 'id')
                  .limit(1)
                  .as('hasChildren'),
              )
              //.select((eb) => this.withHasChildren(eb))
              .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id'),
          ),
      )
      .selectFrom('page_ancestors')
      .selectAll()
      .execute();

    return ancestors.reverse();
  }

  async getRecentSpacePages(
    spaceId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Page>> {
    return await this.pageRepo.getRecentPagesInSpace(spaceId, pagination);
  }

  async getRecentPages(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Page>> {
    return await this.pageRepo.getRecentPages(userId, pagination);
  }

  async forceDelete(pageId: string): Promise<void> {
    const refPages = await this.syncPageRepo.findAllRefsByOriginId(pageId);

    await executeTx(this.db, async (trx) => {
      if (refPages.length > 0) {
        for (const refPage of refPages) {
          await this.pageRepo.deletePage(refPage.referencePageId, trx);
        }
      }

      await this.pageRepo.deletePage(pageId, trx);
    });
  }

  async getMyPages(
    pagination: PaginationOptions,
    pageId?: string,
  ): Promise<PaginationResult<SidebarPageResultDto>> {
    const baseQuery = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        'spaceId',
        'creatorId',
        'isSynced',
      ])
      .select((eb) => this.withHasChildren(eb))
      .orderBy('position', 'asc');

    const query = baseQuery.where(
      'parentPageId',
      pageId ? '=' : 'is',
      pageId ?? null,
    );

    const result: PaginationResult<SidebarPageResultDto> =
      await executeWithPagination(query, {
        page: pagination.page,
        perPage: 250,
      });

    for (const page of result.items) {
      const preferences = await this.pageRepo.findUserPagePreferences(
        page.id,
        page.creatorId,
      );

      if (!preferences) {
        await this.pageRepo.createUserPagePreferences({
          pageId: page.id,
          userId: page.creatorId,
          position: page.position,
          color: '#4CAF50',
        });
        continue;
      }

      page.position = preferences.position;
      page.color = preferences.color ?? '#4CAF50';
    }

    return result;
  }

  async updateMyPageColor(dto: MyPageColorDto, userId: string) {
    const preferences = await this.pageRepo.findUserPagePreferences(
      dto.pageId,
      userId,
    );

    if (!preferences) {
      throw new NotFoundException(`Preferences not found`);
    }

    await this.pageRepo.updateUserPagePreferences({
      pageId: dto.pageId,
      userId,
      color: dto.color,
    });
  }

  async updateForSocket(
    updatePageData: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    this.logger.debug('Updating page: ', updatePageData);

    const pageUpdateResult = await this.pageRepo.updatePageMetadata(
      updatePageData,
      pageId,
      trx,
    );

    if (updatePageData.content) {
      await this.updatePageBlocks(updatePageData, pageId, trx);
    }

    return pageUpdateResult;
  }
}

/*
  // TODO: page deletion and restoration
  async delete(pageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const page = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .select(['page.id', 'page.workspaceId'])
        .getOne();

      if (!page) {
        throw new NotFoundException(`Page not found`);
      }
      await this.softDeleteChildrenRecursive(page.id, manager);
      await this.pageOrderingService.removePageFromHierarchy(page, manager);

      await manager.softDelete(Page, pageId);
    });
  }

  private async softDeleteChildrenRecursive(
    parentId: string,
    manager: EntityManager,
  ): Promise<void> {
    const childrenPage = await manager
      .createQueryBuilder(Page, 'page')
      .where('page.parentPageId = :parentId', { parentId })
      .select(['page.id', 'page.title', 'page.parentPageId'])
      .getMany();

    for (const child of childrenPage) {
      await this.softDeleteChildrenRecursive(child.id, manager);
      await manager.softDelete(Page, child.id);
    }
  }

  async restore(pageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const isDeleted = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .withDeleted()
        .getCount();

      if (!isDeleted) {
        return;
      }

      await manager.recover(Page, { id: pageId });

      await this.restoreChildrenRecursive(pageId, manager);

      // Fetch the page details to find out its parent and workspace
      const restoredPage = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :pageId', { pageId })
        .select(['page.id', 'page.title', 'page.spaceId', 'page.parentPageId'])
        .getOne();

      if (!restoredPage) {
        throw new NotFoundException(`Restored page not found.`);
      }

      // add page back to its hierarchy
      await this.pageOrderingService.addPageToOrder(
        restoredPage.spaceId,
        pageId,
        restoredPage.parentPageId,
      );
    });
  }

  private async restoreChildrenRecursive(
    parentId: string,
    manager: EntityManager,
  ): Promise<void> {
    const childrenPage = await manager
      .createQueryBuilder(Page, 'page')
      .setLock('pessimistic_write')
      .where('page.parentPageId = :parentId', { parentId })
      .select(['page.id', 'page.title', 'page.parentPageId'])
      .withDeleted()
      .getMany();

    for (const child of childrenPage) {
      await this.restoreChildrenRecursive(child.id, manager);
      await manager.recover(Page, { id: child.id });
    }
  }
*/
