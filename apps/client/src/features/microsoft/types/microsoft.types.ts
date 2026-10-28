export type M365Item = {
  kind: "file" | "folder";
  driveId: string;
  itemId: string;
  name: string;
  webUrl: string;
  size?: number;
  mimeType?: string;
  lastModifiedDateTime?: string;
  lastModifiedBy?: string;
  parentPath?: string;
  parentWebUrl?: string;
  siteId?: string;
  thumbnailUrl?: string;
  childCount?: number;
};

export type M365List = {
  kind: "list";
  siteId: string;
  listId: string;
  name: string;
  webUrl: string;
  isLibrary: boolean;
};

export type M365Site = {
  kind: "site";
  siteId: string;
  name: string;
  webUrl: string;
  description?: string;
};

export type M365Drive = {
  driveId: string;
  name: string;
  webUrl: string;
  driveType?: string;
};

export type M365Page<T> = {
  items: T[];
  nextPageToken?: string;
};

export type M365Resolved = M365Item | M365List | M365Site;

export type M365ErrorCode =
  | "not_installed"
  | "needs_connection"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "provider_error"
  | "bad_request";

export type M365NeedsConnection = {
  code: "needs_connection";
  integrationId?: string;
  integrationType?: string;
  integrationName?: string;
  message?: string;
};
