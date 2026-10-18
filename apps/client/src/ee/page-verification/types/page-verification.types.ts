export type VerificationType = "expiring" | "qms";

export type ExpirationMode = "period" | "fixed" | "indefinite";

export type PeriodUnit = "day" | "week" | "month" | "year";

export type VerificationStatus =
  | "verified"
  | "expiring"
  | "expired"
  | "draft"
  | "in_approval"
  | "approved"
  | "obsolete"
  // Readers of a controlled page whose visible content was never approved.
  | "not_approved"
  | "none";

// "page" rows were set up on the page, "space" rows come from the space policy.
export type VerificationSource = "page" | "space";

export type DraftAction = "publish" | "discard";

export type IUserRef = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type IVerifier = {
  id: string;
  name: string;
  avatarUrl: string | null;
  email: string;
};

// What readers see of a controlled page. number is null for a baseline.
export type IReaderVersion = {
  number: number | null;
  approvedAt: string | null;
  approvedBy: IUserRef | null;
  changeSummary?: string | null;
};

export type ILatestReaderVersion = IReaderVersion & {
  id: string;
  kind: "approved" | "baseline";
};

export type IPendingSubmission = {
  // null for submissions made before change summaries existed.
  changeSummary: string | null;
  requestedBy: IUserRef | null;
  requestedAt: string | null;
};

export type IPageVerificationInfo = {
  // null for a page in an approval space that has no approval row of its own yet.
  id?: string | null;
  pageId?: string;
  type?: VerificationType;
  mode?: ExpirationMode | null;
  periodAmount?: number | null;
  periodUnit?: PeriodUnit | null;
  status: VerificationStatus;
  verifiedAt?: string | null;
  verifiedBy?: IUserRef | null;
  expiresAt?: string | null;
  requestedAt?: string | null;
  requestedBy?: IUserRef | null;
  rejectedAt?: string | null;
  rejectedBy?: IUserRef | null;
  rejectionComment?: string | null;
  verifiers?: IVerifier[];
  // Draft users only, from here down to permissions.
  source?: VerificationSource;
  locked?: boolean;
  hasDraftChanges?: boolean;
  pendingHistoryId?: string | null;
  pendingSubmission?: IPendingSubmission | null;
  latestReaderVersion?: ILatestReaderVersion | null;
  spaceRequiresApproval?: boolean;
  editedSinceVerified?: boolean;
  permissions?: IPageVerificationPermissions;
  // Readers only.
  readerVersion?: IReaderVersion | null;
};

export type IPageVerificationPermissions = {
  canVerify: boolean;
  canManage: boolean;
  canSubmitForApproval: boolean;
  canMarkObsolete: boolean;
  canWithdraw: boolean;
  canRemove: boolean;
};

export type ISetupVerification = {
  pageId: string;
  type?: VerificationType;
  mode?: ExpirationMode;
  periodAmount?: number;
  periodUnit?: PeriodUnit;
  fixedExpiresAt?: string;
  verifierIds: string[];
};

export type IUpdateVerification = {
  pageId: string;
  mode?: ExpirationMode;
  periodAmount?: number;
  periodUnit?: PeriodUnit;
  fixedExpiresAt?: string;
  verifierIds?: string[];
};

export type IVerifyPage = {
  pageId: string;
  // Required for approval workflow pages: the submission the approver reviewed.
  pendingHistoryId?: string;
};

export type ISubmitForApproval = {
  pageId: string;
  changeSummary: string;
};

export type IRejectApproval = {
  pageId: string;
  comment?: string;
};

export type IRemoveVerification = {
  pageId: string;
  // Required when the page has draft changes.
  draftAction?: DraftAction;
};

export type ISpaceApprovalInfo = {
  enabled: boolean;
  approvers: IVerifier[];
};

export type IUpdateSpaceApprovalSettings = {
  spaceId: string;
  enabled: boolean;
  // Turning approval on or changing the approvers needs 1 to 5; turning it off sends none.
  approverIds?: string[];
};

export type IVerificationListItem = {
  id: string;
  pageId: string;
  spaceId: string;
  type: VerificationType;
  status: VerificationStatus | null;
  mode: ExpirationMode | null;
  periodAmount: number | null;
  periodUnit: PeriodUnit | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  pageTitle: string | null;
  pageSlugId: string;
  pageIcon: string | null;
  spaceName: string;
  spaceSlug: string;
  verifiers: IUserRef[];
};

export type IVerificationListParams = {
  spaceIds?: string[];
  verifierId?: string;
  type?: VerificationType;
  cursor?: string;
  beforeCursor?: string;
  limit?: number;
  query?: string;
};
