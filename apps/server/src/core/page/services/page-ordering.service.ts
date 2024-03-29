import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovePageDto } from '../dto/move-page.dto';
import {
  OrderingEntity,
  orderPageList,
  removeFromArrayAndSave,
  TreeNode,
} from '../page.util';
import { PageService } from './page.service';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { Page, PageOrdering } from '@docmost/db/types/entity.types';
import { PageWithOrderingDto } from '../dto/page-with-ordering.dto';

@Injectable()
export class PageOrderingService {
  constructor(
    @Inject(forwardRef(() => PageService))
    private pageService: PageService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  // TODO: scope to workspace and space

  async movePage(dto: MovePageDto, trx?: KyselyTransaction): Promise<void> {
    await executeTx(
      this.db,
      async (trx) => {
        const movedPageId = dto.pageId;

        const movedPage = await trx
          .selectFrom('pages as page')
          .select(['page.id', 'page.spaceId', 'page.parentPageId'])
          .where('page.id', '=', movedPageId)
          .executeTakeFirst();

        if (!movedPage) throw new NotFoundException('Moved page not found');

        // if no parentId, it means the page is a root page or now a root page
        if (!dto.parentId) {
          // if it had a parent before being moved, we detach it from the previous parent
          if (movedPage.parentPageId) {
            await this.removeFromParent(
              movedPage.parentPageId,
              dto.pageId,
              trx,
            );
          }
          const spaceOrdering = await this.getEntityOrdering(
            movedPage.spaceId,
            OrderingEntity.SPACE,
            trx,
          );

          orderPageList(spaceOrdering.childrenIds, dto);
          // it should save or update right?
          // await manager.save(spaceOrdering); //TODO: to update or create new record? pretty confusing
          await trx
            .updateTable('page_ordering')
            .set(spaceOrdering)
            .where('id', '=', spaceOrdering.id)
            .execute();
        } else {
          const parentPageId = dto.parentId;

          let parentPageOrdering = await this.getEntityOrdering(
            parentPageId,
            OrderingEntity.PAGE,
            trx,
          );

          if (!parentPageOrdering) {
            parentPageOrdering = await this.createPageOrdering(
              parentPageId,
              OrderingEntity.PAGE,
              movedPage.spaceId,
              trx,
            );
          }

          // Check if the parent was changed
          if (
            movedPage.parentPageId &&
            movedPage.parentPageId !== parentPageId
          ) {
            //if yes, remove moved page from old parent's children
            await this.removeFromParent(
              movedPage.parentPageId,
              dto.pageId,
              trx,
            );
          }

          // If movedPage didn't have a parent initially (was at root level), update the root level
          if (!movedPage.parentPageId) {
            await this.removeFromSpacePageOrder(
              movedPage.spaceId,
              dto.pageId,
              trx,
            );
          }

          // Modify the children list of the new parentPage and save
          orderPageList(parentPageOrdering.childrenIds, dto);
          await trx
            .updateTable('page_ordering')
            .set(parentPageOrdering)
            .where('id', '=', parentPageOrdering.id)
            .execute();
        }

        // update the parent Id of the moved page
        await trx
          .updateTable('pages')
          .set({
            parentPageId: movedPage.parentPageId || null,
          })
          .where('id', '=', movedPage.id)
          .execute();
      },
      trx,
    );
  }

  async addPageToOrder(
    spaceId: string,
    pageId: string,
    parentPageId?: string,
    trx?: KyselyTransaction,
  ) {
    await executeTx(
      this.db,
      async (trx: KyselyTransaction) => {
        if (parentPageId) {
          await this.upsertOrdering(
            parentPageId,
            OrderingEntity.PAGE,
            pageId,
            spaceId,
            trx,
          );
        } else {
          await this.addToSpacePageOrder(spaceId, pageId, trx);
        }
      },
      trx,
    );
  }

  async addToSpacePageOrder(
    spaceId: string,
    pageId: string,
    trx: KyselyTransaction,
  ) {
    await this.upsertOrdering(
      spaceId,
      OrderingEntity.SPACE,
      pageId,
      spaceId,
      trx,
    );
  }

  async removeFromParent(
    parentId: string,
    childId: string,
    trx: KyselyTransaction,
  ): Promise<void> {
    await this.removeChildFromOrdering(
      parentId,
      OrderingEntity.PAGE,
      childId,
      trx,
    );
  }

  async removeFromSpacePageOrder(
    spaceId: string,
    pageId: string,
    trx: KyselyTransaction,
  ) {
    await this.removeChildFromOrdering(
      spaceId,
      OrderingEntity.SPACE,
      pageId,
      trx,
    );
  }

  async removeChildFromOrdering(
    entityId: string,
    entityType: string,
    childId: string,
    trx: KyselyTransaction,
  ): Promise<void> {
    const ordering = await this.getEntityOrdering(entityId, entityType, trx);

    if (ordering && ordering.childrenIds.includes(childId)) {
      await removeFromArrayAndSave(ordering, 'childrenIds', childId, trx);
    }
  }

  async removePageFromHierarchy(
    page: Page,
    trx: KyselyTransaction,
  ): Promise<void> {
    if (page.parentPageId) {
      await this.removeFromParent(page.parentPageId, page.id, trx);
    } else {
      await this.removeFromSpacePageOrder(page.spaceId, page.id, trx);
    }
  }

  async upsertOrdering(
    entityId: string,
    entityType: string,
    childId: string,
    spaceId: string,
    trx: KyselyTransaction,
  ) {
    let ordering = await this.getEntityOrdering(entityId, entityType, trx);

    if (!ordering) {
      ordering = await this.createPageOrdering(
        entityId,
        entityType,
        spaceId,
        trx,
      );
    }

    if (!ordering.childrenIds.includes(childId)) {
      ordering.childrenIds.unshift(childId);
      await trx
        .updateTable('page_ordering')
        .set(ordering)
        .where('id', '=', ordering.id)
        .execute();
      //await manager.save(PageOrdering, ordering);
    }
  }

  async getEntityOrdering(
    entityId: string,
    entityType: string,
    trx: KyselyTransaction,
  ): Promise<PageOrdering> {
    return trx
      .selectFrom('page_ordering')
      .selectAll()
      .where('entityId', '=', entityId)
      .where('entityType', '=', entityType)
      .forUpdate()
      .executeTakeFirst();
  }

  async createPageOrdering(
    entityId: string,
    entityType: string,
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<PageOrdering> {
    await trx
      .insertInto('page_ordering')
      .values({
        entityId,
        entityType,
        spaceId,
        childrenIds: [],
      })
      .onConflict((oc) => oc.columns(['entityId', 'entityType']).doNothing())
      .execute();

    // Todo: maybe use returning above
    return await this.getEntityOrdering(entityId, entityType, trx);
  }

  async getSpacePageOrder(
    spaceId: string,
  ): Promise<{ id: string; childrenIds: string[]; spaceId: string }> {
    return await this.db
      .selectFrom('page_ordering')
      .select(['id', 'childrenIds', 'spaceId'])
      .where('entityId', '=', spaceId)
      .where('entityType', '=', OrderingEntity.SPACE)
      .executeTakeFirst();
  }

  async convertToTree(spaceId: string): Promise<TreeNode[]> {
    const spaceOrder = await this.getSpacePageOrder(spaceId);

    const pageOrder = spaceOrder ? spaceOrder.childrenIds : undefined;
    const pages = await this.pageService.getSidebarPagesBySpaceId(spaceId);

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
