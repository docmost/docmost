import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PageRepository } from '../repositories/page.repository';
import { Page } from '../entities/page.entity';
import { MovePageDto } from '../dto/move-page.dto';
import {
  OrderingEntity,
  orderPageList,
  removeFromArrayAndSave,
  TreeNode,
} from '../page.util';
import { DataSource, EntityManager } from 'typeorm';
import { PageService } from './page.service';
import { PageOrdering } from '../entities/page-ordering.entity';
import { PageWithOrderingDto } from '../dto/page-with-ordering.dto';

@Injectable()
export class PageOrderingService {
  constructor(
    private pageRepository: PageRepository,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PageService))
    private pageService: PageService,
  ) {}

  async movePage(dto: MovePageDto): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const movedPageId = dto.id;

      const movedPage = await manager
        .createQueryBuilder(Page, 'page')
        .where('page.id = :movedPageId', { movedPageId })
        .select(['page.id', 'page.workspaceId', 'page.parentPageId'])
        .getOne();

      if (!movedPage) throw new BadRequestException('Moved page not found');

      if (!dto.parentId) {
        if (movedPage.parentPageId) {
          await this.removeFromParent(movedPage.parentPageId, dto.id, manager);
        }
        const workspaceOrdering = await this.getEntityOrdering(
          movedPage.workspaceId,
          OrderingEntity.workspace,
          manager,
        );

        orderPageList(workspaceOrdering.childrenIds, dto);

        await manager.save(workspaceOrdering);
      } else {
        const parentPageId = dto.parentId;

        let parentPageOrdering = await this.getEntityOrdering(
          parentPageId,
          OrderingEntity.page,
          manager,
        );

        if (!parentPageOrdering) {
          parentPageOrdering = await this.createPageOrdering(
            parentPageId,
            OrderingEntity.page,
            movedPage.workspaceId,
            manager,
          );
        }

        // Check if the parent was changed
        if (movedPage.parentPageId && movedPage.parentPageId !== parentPageId) {
          //if yes, remove moved page from old parent's children
          await this.removeFromParent(movedPage.parentPageId, dto.id, manager);
        }

        // If movedPage didn't have a parent initially (was at root level), update the root level
        if (!movedPage.parentPageId) {
          await this.removeFromWorkspacePageOrder(
            movedPage.workspaceId,
            dto.id,
            manager,
          );
        }

        // Modify the children list of the new parentPage and save
        orderPageList(parentPageOrdering.childrenIds, dto);
        await manager.save(parentPageOrdering);
      }

      movedPage.parentPageId = dto.parentId || null;
      await manager.save(movedPage);
    });
  }

  async addPageToOrder(
    workspaceId: string,
    pageId: string,
    parentPageId?: string,
  ) {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      if (parentPageId) {
        await this.upsertOrdering(
          parentPageId,
          OrderingEntity.page,
          pageId,
          workspaceId,
          manager,
        );
      } else {
        await this.addToWorkspacePageOrder(workspaceId, pageId, manager);
      }
    });
  }

  async addToWorkspacePageOrder(
    workspaceId: string,
    pageId: string,
    manager: EntityManager,
  ) {
    await this.upsertOrdering(
      workspaceId,
      OrderingEntity.workspace,
      pageId,
      workspaceId,
      manager,
    );
  }

  async removeFromParent(
    parentId: string,
    childId: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.removeChildFromOrdering(
      parentId,
      OrderingEntity.page,
      childId,
      manager,
    );
  }

  async removeFromWorkspacePageOrder(
    workspaceId: string,
    pageId: string,
    manager: EntityManager,
  ) {
    await this.removeChildFromOrdering(
      workspaceId,
      OrderingEntity.workspace,
      pageId,
      manager,
    );
  }

  async removeChildFromOrdering(
    entityId: string,
    entityType: string,
    childId: string,
    manager: EntityManager,
  ): Promise<void> {
    const ordering = await this.getEntityOrdering(
      entityId,
      entityType,
      manager,
    );

    if (ordering && ordering.childrenIds.includes(childId)) {
      await removeFromArrayAndSave(ordering, 'childrenIds', childId, manager);
    }
  }

  async removePageFromHierarchy(
    page: Page,
    manager: EntityManager,
  ): Promise<void> {
    if (page.parentPageId) {
      await this.removeFromParent(page.parentPageId, page.id, manager);
    } else {
      await this.removeFromWorkspacePageOrder(
        page.workspaceId,
        page.id,
        manager,
      );
    }
  }

  async upsertOrdering(
    entityId: string,
    entityType: string,
    childId: string,
    workspaceId: string,
    manager: EntityManager,
  ) {
    let ordering = await this.getEntityOrdering(entityId, entityType, manager);

    if (!ordering) {
      ordering = await this.createPageOrdering(
        entityId,
        entityType,
        workspaceId,
        manager,
      );
    }

    if (!ordering.childrenIds.includes(childId)) {
      ordering.childrenIds.unshift(childId);
      await manager.save(PageOrdering, ordering);
    }
  }

  async getEntityOrdering(
    entityId: string,
    entityType: string,
    manager,
  ): Promise<PageOrdering> {
    return manager
      .createQueryBuilder(PageOrdering, 'ordering')
      .setLock('pessimistic_write')
      .where('ordering.entityId = :entityId', { entityId })
      .andWhere('ordering.entityType = :entityType', {
        entityType,
      })
      .getOne();
  }

  async createPageOrdering(
    entityId: string,
    entityType: string,
    workspaceId: string,
    manager: EntityManager,
  ): Promise<PageOrdering> {
    await manager.query(
      `INSERT INTO page_ordering ("entityId", "entityType", "workspaceId", "childrenIds") 
     VALUES ($1, $2, $3, '{}')
     ON CONFLICT ("entityId", "entityType") DO NOTHING`,
      [entityId, entityType, workspaceId],
    );

    return await this.getEntityOrdering(entityId, entityType, manager);
  }

  async getWorkspacePageOrder(workspaceId: string): Promise<PageOrdering> {
    return await this.dataSource
      .createQueryBuilder(PageOrdering, 'ordering')
      .select(['ordering.id', 'ordering.childrenIds', 'ordering.workspaceId'])
      .where('ordering.entityId = :workspaceId', { workspaceId })
      .andWhere('ordering.entityType = :entityType', {
        entityType: OrderingEntity.workspace,
      })
      .getOne();
  }

  async convertToTree(workspaceId: string): Promise<TreeNode[]> {
    const workspaceOrder = await this.getWorkspacePageOrder(workspaceId);

    const pageOrder = workspaceOrder ? workspaceOrder.childrenIds : undefined;
    const pages = await this.pageService.getSidebarPagesByWorkspaceId(workspaceId);

    const pageMap: { [id: string]: PageWithOrderingDto } = {};
    pages.forEach((page) => {
      pageMap[page.id] = page;
    });

    function buildTreeNode(id: string): TreeNode | undefined {
      const page = pageMap[id];
      if (!page) return;

      const node: TreeNode = {
        id: page.id,
        title: page.title || '',
        children: [],
      };

      if (page.icon) node.icon = page.icon;

      if (page.childrenIds && page.childrenIds.length > 0) {
        node.children = page.childrenIds
          .map((childId) => buildTreeNode(childId))
          .filter(Boolean) as TreeNode[];
      }

      return node;
    }

    return pageOrder
      .map((id) => buildTreeNode(id))
      .filter(Boolean) as TreeNode[];
  }
}
