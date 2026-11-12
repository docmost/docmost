export type LegalHoldStatus = "active" | "released";

export type PreservedItemType =
  | "page"
  | "page_history"
  | "comment"
  | "attachment"
  | "base_row"
  | "base_property"
  | "ai_chat"
  | "user"
  | "space";

export type PreservationReason = "deleted" | "edited";

export type LegalHoldExportStatus =
  | "processing"
  | "success"
  | "failed"
  | "expired";

export type LegalHoldActor = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type LegalHoldUserView = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  deactivatedAt: string | null;
  deletedAt: string | null;
};

export type LegalHoldSpaceView = {
  id: string;
  name: string | null;
  slug: string | null;
  logo: string | null;
  archivedAt: string | null;
  deleted: boolean;
};

export type LegalHoldListItem = {
  id: string;
  name: string;
  description: string | null;
  status: LegalHoldStatus;
  custodianCount: number;
  spaceCount: number;
  // only the first five; custodianCount has the total
  custodians: LegalHoldUserView[];
  creator: LegalHoldActor | null;
  releasedBy: LegalHoldActor | null;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
};

export type LegalHoldDetail = Omit<LegalHoldListItem, "custodians"> & {
  custodians: LegalHoldUserView[];
  spaces: LegalHoldSpaceView[];
  preservedItemCount: number;
  pagesInScopeCount: number;
};

export type PreservedItemView = {
  id: string;
  type: PreservedItemType;
  reason: PreservationReason;
  itemId: string;
  pageId: string | null;
  spaceId: string | null;
  spaceName: string | null;
  title: string | null;
  actor: LegalHoldActor | null;
  childCounts: Partial<Record<PreservedItemType, number>>;
  createdAt: string;
  releasedAt: string | null;
  purgeAt: string | null;
};

export type PreservedItemDetail = PreservedItemView & {
  html: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
};

export type LegalHoldExportView = {
  id: string;
  legalHoldId: string;
  status: LegalHoldExportStatus;
  fileName: string;
  fileSize: number | null;
  errorMessage: string | null;
  creator: LegalHoldActor | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type LegalHoldSearchParams = {
  query?: string;
  cursor?: string;
  limit?: number;
};

export type LegalHoldListParams = LegalHoldSearchParams & {
  released?: boolean;
};

export type LegalHoldIdInput = { legalHoldId: string };

export type CreateLegalHoldInput = {
  name: string;
  description?: string;
  userIds: string[];
  spaceIds: string[];
};

export type UpdateLegalHoldInput = LegalHoldIdInput &
  Partial<CreateLegalHoldInput>;

export type PreservedItemListParams = LegalHoldIdInput &
  LegalHoldSearchParams & {
    type?: PreservedItemType;
  };

export type PreservedItemIdInput = LegalHoldIdInput & { itemId: string };
