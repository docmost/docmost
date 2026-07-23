interface IPageHistoryUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface IPageHistory {
  id: string;
  pageId: string;
  title: string;
  content?: any;
  slug: string;
  icon: string;
  coverPhoto: string;
  version: number;
  lastUpdatedById: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: IPageHistoryUser;
  contributors?: IPageHistoryUser[];
  // E2EE snapshots carry ciphertext instead of `content`; it is decrypted in
  // the browser with the page DEK and never enters the query cache decrypted.
  isEncrypted?: boolean;
  encryptedBlob?: string | null;
}
