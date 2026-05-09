export type BacklinkDirection = "incoming" | "outgoing";

export interface IBacklinkCount {
  incoming: number;
  outgoing: number;
}

export interface IBacklinkPageItem {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  spaceSlug: string | null;
  spaceName: string | null;
  updatedAt: string;
}

export interface IBacklinksListParams {
  pageId: string;
  direction: BacklinkDirection;
  cursor?: string;
  limit?: number;
}
