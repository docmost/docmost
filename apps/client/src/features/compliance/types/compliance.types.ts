export interface IComplianceUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface IComplianceScope {
  pageId?: string;
  spaceId?: string;
}

export interface IChangeEntry {
  id: string;
  summary: string;
  detail: string | null;
  position: number | null;
  createdAt: string;
}

export interface IChangeSet {
  id: string;
  pageId: string | null;
  spaceId: string | null;
  workspaceId: string;
  reason: string;
  requestedBy: string;
  targetSystem: string | null;
  ticketRef: string | null;
  performedById: string | null;
  correctsId: string | null;
  createdAt: string;
  performedBy: IComplianceUser | null;
  entries: IChangeEntry[];
}

export interface IChangeEntryInput {
  summary: string;
  detail?: string;
}

export interface ICreateChangeSet {
  pageId?: string;
  spaceId?: string;
  reason: string;
  requestedBy: string;
  targetSystem?: string;
  ticketRef?: string;
  correctsId?: string;
  entries: IChangeEntryInput[];
}

export interface IChangeLogInfo {
  enabled: boolean;
  inherited: boolean;
  undocumented: boolean;
}

export type ReviewStatus = "ok" | "due" | "overdue";

export interface IReviewSetting {
  id: string;
  pageId: string | null;
  spaceId: string | null;
  workspaceId: string;
  intervalDays: number;
  lastReviewedAt: string | null;
  lastReviewedById: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastReviewedBy: IComplianceUser | null;
}

export interface IReviewInfo {
  setting: IReviewSetting | null;
  status: ReviewStatus | null;
  inherited: boolean;
}

export interface IReviewRecord {
  id: string;
  reviewSettingId: string;
  pageId: string | null;
  spaceId: string | null;
  workspaceId: string;
  reviewedById: string | null;
  reviewedAt: string;
  note: string | null;
  createdAt: string;
  reviewedBy: IComplianceUser | null;
}
