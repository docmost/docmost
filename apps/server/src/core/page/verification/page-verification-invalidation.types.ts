import { Page, PageVerification } from '@docmost/db/types/entity.types';

export type VerificationEditState = Pick<
  PageVerification,
  | 'type'
  | 'status'
  | 'verifiedAt'
  | 'requestedAt'
  | 'expiresAt'
  | 'invalidatedAt'
>;

export type PageVerificationInvalidation = {
  verificationId: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  verificationType: string;
  previousStatus: string;
  newStatus: string;
};

export type PreviousPageState = Pick<
  Page,
  | 'slugId'
  | 'title'
  | 'content'
  | 'icon'
  | 'coverPhoto'
  | 'lastUpdatedById'
  | 'creatorId'
  | 'spaceId'
  | 'workspaceId'
>;

export type InvalidateForEditInput = {
  pageId: string;
  userId: string | null;
  changedAt: Date | null;
  isMeaningfulChange: () => boolean;
  loadPreviousState: () => Promise<PreviousPageState>;
};
