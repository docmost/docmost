import { Injectable } from '@nestjs/common';
import {
  FavoriteRepo,
  FavoriteType,
} from '@docmost/db/repos/favorite/favorite.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { InsertableFavorite } from '@docmost/db/types/entity.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

@Injectable()
export class FavoriteService {
  constructor(
    private readonly favoriteRepo: FavoriteRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async getFavoriteIds(
    userId: string,
    workspaceId: string,
    type: FavoriteType,
    spaceId?: string,
  ) {
    const result = await this.favoriteRepo.getFavoriteIds(
      userId,
      workspaceId,
      type,
      spaceId,
    );

    if (result.items.length === 0) {
      return result;
    }

    if (type === FavoriteType.PAGE) {
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds: result.items,
          userId,
        });
      const accessibleSet = new Set(accessibleIds);
      result.items = result.items.filter((id) => accessibleSet.has(id));
    }

    return result;
  }

  async addFavorite(
    userId: string,
    workspaceId: string,
    opts: {
      type: FavoriteType;
      pageId?: string;
      spaceId?: string;
      templateId?: string;
    },
  ): Promise<void> {
    const favorite: InsertableFavorite = {
      userId,
      pageId: opts.pageId ?? null,
      spaceId: opts.spaceId ?? null,
      templateId: opts.templateId ?? null,
      type: opts.type,
      workspaceId,
    };

    await this.favoriteRepo.insert(favorite);
  }

  async removeFavorite(
    userId: string,
    opts: {
      type: FavoriteType;
      pageId?: string;
      spaceId?: string;
      templateId?: string;
    },
  ): Promise<void> {
    if (opts.type === FavoriteType.PAGE && opts.pageId) {
      await this.favoriteRepo.deleteByUserAndPage(userId, opts.pageId);
    } else if (opts.type === FavoriteType.SPACE && opts.spaceId) {
      await this.favoriteRepo.deleteByUserAndSpace(userId, opts.spaceId);
    } else if (opts.type === FavoriteType.TEMPLATE && opts.templateId) {
      await this.favoriteRepo.deleteByUserAndTemplate(userId, opts.templateId);
    }
  }

  async getUserFavorites(
    userId: string,
    workspaceId: string,
    pagination: PaginationOptions,
    type?: FavoriteType,
    spaceId?: string,
  ) {
    const result = await this.favoriteRepo.findUserFavorites(
      userId,
      workspaceId,
      pagination,
      type,
      spaceId,
    );

    if (result.items.length === 0) {
      return result;
    }

    const pageFavorites = result.items.filter(
      (f) => f.type === FavoriteType.PAGE && f.pageId,
    );

    let accessiblePageSet: Set<string> | undefined;
    if (pageFavorites.length > 0) {
      const pageIds = pageFavorites.map((f) => f.pageId as string);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
      accessiblePageSet = new Set(accessibleIds);
    }

    result.items = result.items.filter(
      (f) =>
        f.type !== FavoriteType.PAGE ||
        (f.pageId && accessiblePageSet?.has(f.pageId)),
    );

    return result;
  }
}
