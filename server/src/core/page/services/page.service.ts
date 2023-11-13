import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepository } from '../repositories/page.repository';
import { CreatePageDto } from '../dto/create-page.dto';
import { Page } from '../entities/page.entity';
import { UpdatePageDto } from '../dto/update-page.dto';
import { plainToInstance } from 'class-transformer';
import { DataSource, EntityManager } from 'typeorm';
import { PageOrderingService } from './page-ordering.service';
import { PageWithOrderingDto } from '../dto/page-with-ordering.dto';
import { OrderingEntity, transformPageResult } from '../page.util';

@Injectable()
export class PageService {
  constructor(
    private pageRepository: PageRepository,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PageOrderingService))
    private pageOrderingService: PageOrderingService,
  ) {}

  async findWithBasic(pageId: string) {
    return this.pageRepository.findOne({
      where: { id: pageId },
      select: ['id', 'title'],
    });
  }

  async findById(pageId: string) {
    return this.pageRepository.findById(pageId);
  }

  async findWithoutYDoc(pageId: string) {
    return this.pageRepository.findWithoutYDoc(pageId);
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    const page = plainToInstance(Page, createPageDto);
    page.creatorId = userId;
    page.workspaceId = workspaceId;
    page.lastUpdatedById = userId;

    if (createPageDto.parentPageId) {
      // TODO: make sure parent page belongs to same workspace and user has permissions
      const parentPage = await this.pageRepository.findOne({
        where: { id: createPageDto.parentPageId },
        select: ['id'],
      });

      if (!parentPage) throw new BadRequestException('Parent page not found');
    }

    const createdPage = await this.pageRepository.save(page);

    await this.pageOrderingService.addPageToOrder(
      workspaceId,
      createPageDto.id,
      createPageDto.parentPageId,
    );

    return createdPage;
  }

  async update(
    pageId: string,
    updatePageDto: UpdatePageDto,
    userId: string,
  ): Promise<Page> {
    const updateData = {
      ...updatePageDto,
      lastUpdatedById: userId,
    };

    const result = await this.pageRepository.update(pageId, updateData);
    if (result.affected === 0) {
      throw new BadRequestException(`Page not found`);
    }

    return await this.pageRepository.findWithoutYDoc(pageId);
  }

  async updateState(
    pageId: string,
    content: any,
    ydoc: any,
    userId?: string, // TODO: fix this
  ): Promise<void> {
    await this.pageRepository.update(pageId, {
      content: content,
      ydoc: ydoc,
      ...(userId && { lastUpdatedById: userId }),
    });
  }

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
        .select([
          'page.id',
          'page.title',
          'page.workspaceId',
          'page.parentPageId',
        ])
        .getOne();

      if (!restoredPage) {
        throw new NotFoundException(`Restored page not found.`);
      }

      // add page back to its hierarchy
      await this.pageOrderingService.addPageToOrder(
        restoredPage.workspaceId,
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

  async forceDelete(pageId: string): Promise<void> {
    await this.pageRepository.delete(pageId);
  }

  async lockOrUnlockPage(pageId: string, lock: boolean): Promise<Page> {
    await this.pageRepository.update(pageId, { isLocked: lock });
    return await this.pageRepository.findById(pageId);
  }

  async getSidebarPagesByWorkspaceId(
    workspaceId: string,
    limit = 200,
  ): Promise<PageWithOrderingDto[]> {
    const pages = await this.pageRepository
      .createQueryBuilder('page')
      .leftJoin(
        'page_ordering',
        'ordering',
        'ordering.entityId = page.id AND ordering.entityType = :entityType',
        { entityType: OrderingEntity.page },
      )
      .where('page.workspaceId = :workspaceId', { workspaceId })
      .select([
        'page.id',
        'page.title',
        'page.icon',
        'page.parentPageId',
        'ordering.childrenIds',
        'page.creatorId',
        'page.createdAt',
      ])
      .orderBy('page.createdAt', 'DESC')
      .take(limit)
      .getRawMany<PageWithOrderingDto[]>();

    return transformPageResult(pages);
  }

  async getRecentWorkspacePages(
    workspaceId: string,
    limit = 20,
    offset = 0,
  ): Promise<Page[]> {
    const pages = await this.pageRepository
      .createQueryBuilder('page')
      .where('page.workspaceId = :workspaceId', { workspaceId })
      .select([
        'page.id',
        'page.title',
        'page.slug',
        'page.icon',
        'page.coverPhoto',
        'page.editor',
        'page.shareId',
        'page.parentPageId',
        'page.creatorId',
        'page.lastUpdatedById',
        'page.workspaceId',
        'page.isLocked',
        'page.status',
        'page.publishedAt',
        'page.createdAt',
        'page.updatedAt',
        'page.deletedAt',
      ])
      .orderBy('page.updatedAt', 'DESC')
      .offset(offset)
      .take(limit)
      .getMany();
    return pages;
  }
}
