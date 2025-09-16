import { Json, Timestamp, Generated } from '@docmost/db/types/db';

// embeddings type
export interface Embeddings {
  id: Generated<string>;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  attachmentId: string;
  embedding: number[] | Buffer | string;
  chunkIndex: Generated<number>;
  chunkStart: Generated<number>;
  chunkLength: Generated<number>;
  metadata: Generated<Json>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  deletedAt: Timestamp | null;
}
