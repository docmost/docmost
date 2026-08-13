import { Injectable } from '@nestjs/common';

export type PageViewPayload = {
  pageId: string;
  workspaceId?: string;
  spaceId?: string;
  shareId?: string;
  userId?: string | null;
  visitorId?: string;
};

export const PAGE_VIEW_SERVICE = Symbol('PAGE_VIEW_SERVICE');

export interface IPageViewService {
  track(payload: PageViewPayload): void | Promise<void>;
}

@Injectable()
export class NoopPageViewService implements IPageViewService {
  track(_payload: PageViewPayload): void {}
}
