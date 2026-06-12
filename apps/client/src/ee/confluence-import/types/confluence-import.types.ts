export type ConfluenceAuthType = "cloud_token" | "pat" | "basic";

export type ConfluenceCredentials = {
  siteUrl: string;
  authType: ConfluenceAuthType;
  email?: string;
  token?: string;
  username?: string;
  password?: string;
};

export type ConfluenceSpaceSummary = {
  id: string;
  key: string;
  name: string;
  type?: string;
  status?: string;
};

export type TestConnectionResponse = {
  success: boolean;
  edition?: string;
  spaceCount?: number;
  error?: string;
};

export type ListSpacesResponse = {
  success: boolean;
  spaces?: ConfluenceSpaceSummary[];
  error?: string;
};

export type StartImportResponse = {
  success: boolean;
  fileTaskId?: string;
  error?: string;
};

export type ConfluenceImportStatus = "processing" | "success" | "failed";

export type ImportStatusResponse = {
  fileTaskId?: string;
  status?: ConfluenceImportStatus;
  errorMessage?: string | null;
  currentPhase?: string | null;
  totalSpaces?: number;
  importedSpaces?: number;
  totalPages?: number;
  importedPages?: number;
  totalUsers?: number;
  importedUsers?: number;
  totalGroups?: number;
  importedGroups?: number;
  totalRestrictedPages?: number;
  importedRestrictedPages?: number;
  warnings?: string[];
  createdAt?: string;
  updatedAt?: string;
  error?: string;
};

export type ConfluenceImportHistoryItem = {
  fileTaskId: string;
  siteUrl: string;
  status: ConfluenceImportStatus;
  errorMessage: string | null;
  currentPhase: string | null;
  totalSpaces: number;
  importedSpaces: number;
  totalPages: number;
  importedPages: number;
  totalUsers: number;
  importedUsers: number;
  totalGroups: number;
  importedGroups: number;
  totalAttachments: number;
  importedAttachments: number;
  totalLabels: number;
  importedLabels: number;
  totalRestrictedPages: number;
  importedRestrictedPages: number;
  cancelled: boolean;
  spaceKeys: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  creatorId: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

export type ListImportsResponse = {
  items: ConfluenceImportHistoryItem[];
};
