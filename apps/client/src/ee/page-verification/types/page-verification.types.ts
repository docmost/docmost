import type { JSONContent } from "@tiptap/react";

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
  | "invalidated"
  | "none";

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

export type IPageVerificationInfo = {
  id?: string;
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
  invalidatedAt?: string | null;
  invalidatedBy?: IUserRef | null;
  verifiedHistoryId?: string | null;
  rejectedHistoryId?: string | null;
  verifiers?: IVerifier[];
  permissions?: IPageVerificationPermissions;
};

export type VerificationChangesBaselineKind = "verified" | "rejected";

export type IVerificationChangesBaseline = {
  historyId: string;
  title: string | null;
  content: JSONContent;
  hasChanges: boolean;
};

export type IVerificationChanges = {
  type: VerificationType;
  verified:
    | (IVerificationChangesBaseline & {
        verifiedAt: string | null;
        verifiedBy: IUserRef | null;
      })
    | null;
  rejected:
    | (IVerificationChangesBaseline & {
        rejectedAt: string | null;
        rejectedBy: IUserRef | null;
      })
    | null;
  current: {
    title: string | null;
    content: JSONContent;
    updatedAt: string;
    lastUpdatedBy: IUserRef | null;
  };
};

export type ReviewChangesRequest = {
  pageId: string;
  source: "modal" | "link";
};

export type BaselineCopy = {
  title: string;
  byLine: (values: { name: string; time: string }) => string;
  matches: string;
};

export type ReviewLinkTarget = "review" | "verification" | "none";

export type IPageVerificationPermissions = {
  canVerify: boolean;
  canManage: boolean;
  canSubmitForApproval: boolean;
  canMarkObsolete: boolean;
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
  verifiedBy: IUserRef | null;
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
