interface IPageHistoryUser {
  id: string;
  name: string;
  avatarUrl: string;
}

// null for regular history; "draft" rows are snapshots of a controlled page's draft.
export type PageHistoryKind = "draft" | "approved" | "baseline";

export interface IPageHistory {
  id: string;
  pageId: string;
  title: string;
  content?: any;
  slug: string;
  icon: string;
  coverPhoto: string;
  // The approved version number, set on approved rows only.
  version: number | null;
  kind: PageHistoryKind | null;
  changeSummary: string | null;
  approvedBy: IPageHistoryUser | null;
  approvedAt: string | null;
  lastUpdatedById: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: IPageHistoryUser;
  contributors?: IPageHistoryUser[];
}
