import { Injectable } from '@nestjs/common';

export type PageAnalyticsPayload = {
  pageId: string;
  workspaceId?: string;
  spaceId?: string;
  shareId?: string;
  userId?: string | null;
  visitorId?: string;
};

export const PAGE_ANALYTICS_SERVICE = Symbol('PAGE_ANALYTICS_SERVICE');

export interface IPageAnalyticsService {
  track(payload: PageAnalyticsPayload): void | Promise<void>;
}

@Injectable()
export class NoopPageAnalyticsService implements IPageAnalyticsService {
  track(_payload: PageAnalyticsPayload): void {}
}
