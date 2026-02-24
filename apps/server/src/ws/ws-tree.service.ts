import { Injectable } from '@nestjs/common';
import { Page } from '@docmost/db/types/entity.types';
import { WsService } from './ws.service';

@Injectable()
export class WsTreeService {
  constructor(private readonly wsService: WsService) {}

  async notifyPageRestricted(page: Page, excludeUserId: string): Promise<void> {
    await this.wsService.emitToSpaceExceptUsers(page.spaceId, [excludeUserId], {
      operation: 'deleteTreeNode',
      spaceId: page.spaceId,
      payload: {
        node: {
          id: page.id,
          slugId: page.slugId,
        },
      },
    });
  }

  async notifyPermissionGranted(page: Page, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    await this.wsService.emitToUsers(userIds, {
      operation: 'addTreeNode',
      spaceId: page.spaceId,
      payload: {
        parentId: page.parentPageId ?? null,
        index: 0,
        data: {
          id: page.id,
          slugId: page.slugId,
          name: page.title ?? '',
          title: page.title,
          icon: page.icon,
          position: page.position,
          spaceId: page.spaceId,
          parentPageId: page.parentPageId,
          creatorId: page.creatorId,
          hasChildren: false,
          children: [],
        },
      },
    });
  }
}
