import { Json, Timestamp, Generated } from '@docmost/db/types/db';

export interface ConfluenceApiImports {
  id: Generated<string>;
  fileTaskId: string;
  siteUrl: string;
  authType: string;
  authEmail: string | null;
  authToken: string | null;
  authUsername: string | null;
  totalSpaces: Generated<number>;
  importedSpaces: Generated<number>;
  totalPages: Generated<number>;
  importedPages: Generated<number>;
  totalUsers: Generated<number>;
  importedUsers: Generated<number>;
  idMapping: Generated<Json>;
  warnings: Generated<Json>;
  currentPhase: string | null;
  cancelled: Generated<boolean>;
  spaceKeys: Generated<Json>;
  workspaceId: string;
  creatorId: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}
