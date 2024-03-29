import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageOrderingService } from './page-ordering.service';
import { PageWithOrderingDto } from '../dto/page-with-ordering.dto';
import { transformPageResult } from '../page.util';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { Page } from '@docmost/db/types/entity.types';
import { PaginationOptions } from 'src/helpers/pagination/pagination-options';
import { PaginationMetaDto } from 'src/helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from 'src/helpers/pagination/paginated-result';

@Injectable()
export class PageService {
  constructor(
    private pageRepo: PageRepo,
    @Inject(forwardRef(() => PageOrderingService))
    private pageOrderingService: PageOrderingService,
  ) {}

  async findById(
    pageId: string,
    includeContent?: boolean,
    includeYdoc?: boolean,
  ): Promise<Page> {
    return this.pageRepo.findById(pageId, includeContent, includeYdoc);
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    // check if parent page exists
    if (createPageDto.parentPageId) {
      // TODO: make sure parent page belongs to same space and user has permissions
      const parentPage = await this.pageRepo.findById(
        createPageDto.parentPageId,
      );
      if (!parentPage) throw new NotFoundException('Parent page not found');
    }

    //TODO: should be in a transaction
    const createdPage = await this.pageRepo.insertPage({
      ...createPageDto,
      creatorId: userId,
      workspaceId: workspaceId,
      lastUpdatedById: userId,
    });

    await this.pageOrderingService.addPageToOrder(
      createPageDto.spaceId,
      createPageDto.pageId,
      createPageDto.parentPageId,
    );

    return createdPage;
  }

  async update(
    pageId: string,
    updatePageDto: UpdatePageDto,
    userId: string,
  ): Promise<void> {
    await this.pageRepo.updatePage(
      {
        ...updatePageDto,
        lastUpdatedById: userId,
      },
      pageId,
    );

    //return await this.pageRepo.findById(pageId);
  }

  async updateState(
    pageId: string,
    content: any,
    textContent: string,
    ydoc: any,
    userId?: string, // TODO: fix this
  ): Promise<void> {
    await this.pageRepo.updatePage(
      {
        content: content,
        textContent: textContent,
        ydoc: ydoc,
        ...(userId && { lastUpdatedById: userId }),
      },
      pageId,
    );
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
  async forceDelete(pageId: string): Promise<void> {
    await this.pageRepo.deletePage(pageId);
  }

  async getSidebarPagesBySpaceId(
    spaceId: string,
    limit = 200,
  ): Promise<PageWithOrderingDto[]> {
    const pages = await this.pageRepo.getSpaceSidebarPages(spaceId, limit);
    return transformPageResult(pages);
  }

  async getRecentSpacePages(
    spaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Page>> {
    const { pages, count } = await this.pageRepo.getRecentPagesInSpace(
      spaceId,
      paginationOptions,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(pages, paginationMeta);
  }
}
