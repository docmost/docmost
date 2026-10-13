import { MentionNode } from '../../../common/helpers/prosemirror/utils';

export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
  internalLinkSlugIds?: string[];
}

export interface IAddPageWatchersJob {
  userIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}

export interface IPageHistoryJob {
  pageId: string;
}

export interface INotificationCreateJob {
  userId: string;
  workspaceId: string;
  type: string;
  actorId?: string;
  pageId?: string;
  spaceId?: string;
  commentId?: string;
  data?: Record<string, unknown>;
}

export interface ICommentNotificationJob {
  commentId: string;
  parentCommentId?: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  mentionedUserIds: string[];
  notifyWatchers: boolean;
}

export interface ICommentResolvedNotificationJob {
  commentId: string;
  commentCreatorId: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
}

export interface IPageMentionNotificationJob {
  userMentions: { userId: string; mentionId: string; creatorId: string }[];
  oldMentionedUserIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}

export interface IPageUpdateNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorIds: string[];
}

export interface IPermissionGrantedNotificationJob {
  userIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  role: string;
}

export interface IVerificationExpiringNotificationJob {
  verificationId: string;
}

export interface IVerificationExpiredNotificationJob {
  verificationId: string;
}

export interface IVerificationReconcileJob {
  // no payload
}

export interface IPageVerifiedNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  verifierIds: string[];
}

export interface IApprovalRequestedNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  verifierIds: string[];
}

export interface IApprovalRejectedNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  requestedById: string;
  comment?: string;
}

export interface IBaseTypeConversionJob {
  pageId: string;
  propertyId: string;
  workspaceId: string;
  fromType: string;
  toType: string;
  // Snapshots taken at enqueue time so the job stays correct even if the
  // property's current typeOptions drift while the job waits in the queue.
  fromTypeOptions: unknown;
  toTypeOptions: unknown;
  // When true, the job nulls the cell values for that property instead of
  // attempting a value conversion. Used for any conversion where the new
  // type has no meaningful representation of the old value (e.g. involving
  // a system type).
  clearMode: boolean;
  // Staging identity: guards redelivery and failure cleanup against a
  // same-type re-stage made after this job was enqueued.
  pendingToken: string;
  actorId?: string;
}

export interface IBaseCellGcJob {
  pageId: string;
  propertyId: string;
  workspaceId: string;
}

export interface IBaseFormulaRecomputeJob {
  pageId: string;
  workspaceId: string;
  propertyIds: string[]; // formula properties to recompute
  reason:
    | 'formula_created'
    | 'formula_edited'
    | 'dep_type_changed'
    | 'dep_deleted'
    | 'bulk_import'
    | 'manual';
  actorId?: string | null;
  // When set, scope recompute to these row IDs instead of the whole base.
  // Used by the bulk-write path (> FORMULA_INLINE_ROW_THRESHOLD).
  rowIds?: string[];
}
