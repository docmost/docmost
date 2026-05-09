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
  space: { id: string; slug: string; name: string } | null;
  updatedAt: string;
}

export interface IBacklinksListParams {
  pageId: string;
  direction: BacklinkDirection;
  cursor?: string;
  limit?: number;
}
