import { Page } from '@docmost/db/types/entity.types';

export type ApprovalStatus = 'draft' | 'in_approval' | 'approved' | 'obsolete';

export type ApprovalState = {
  controlled: boolean;
  source: 'page' | 'space' | null;
  verificationId: string | null;
  status: ApprovalStatus | null;
  locked: boolean;
  hasReaderVersion: boolean;
  unpublished: boolean;
  spaceRequiresApproval: boolean;
  pendingHistoryId: string | null;
  readerVersionId: string | null;
  disabling: boolean;
};

export type ApprovalPage = Pick<Page, 'id' | 'spaceId' | 'isBase'>;

export type SpaceApprovalSettings = {
  enabled: boolean;
  approverIds: string[];
  disabling: boolean;
};

// A page row joined to its verification row and space settings.
export type ApprovalStateInput = {
  isBase: boolean;
  readerVersionId?: string | null;
  spaceSettings?: unknown;
  verificationId?: string | null;
  verificationType?: string | null;
  verificationStatus?: string | null;
  verificationSource?: string | null;
  pendingHistoryId?: string | null;
};

export type ApprovalContent = {
  content: any;
  title: string | null;
  icon: string | null;
  isDraft: boolean;
};
