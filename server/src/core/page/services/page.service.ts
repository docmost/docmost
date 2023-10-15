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

  async findById(pageId: string) {
    return this.pageRepository.findById(pageId);
  }

  async create(
    userId: string,
    workspaceId: string,
    createPageDto: CreatePageDto,
  ): Promise<Page> {
    const page = plainToInstance(Page, createPageDto);
    page.creatorId = userId;
    page.workspaceId = workspaceId;

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

  async update(pageId: string, updatePageDto: UpdatePageDto): Promise<Page> {
    const existingPage = await this.pageRepository.findOne({
      where: { id: pageId },
    });

    if (!existingPage) {
      throw new BadRequestException(`Page not found`);
    }

    Object.assign(existingPage, updatePageDto);

    return await this.pageRepository.save(existingPage);
  }

  async updateState(pageId: string, content: any, ydoc: any): Promise<void> {
    await this.pageRepository.update(pageId, {
      content: content,
      ydoc: ydoc,
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

  async getRecentPages(limit = 10): Promise<Page[]> {
    return await this.pageRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  async getByWorkspaceId(
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
}
