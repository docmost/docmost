import { Json, Timestamp, Generated } from '@docmost/db/types/db';

// embeddings type
export interface PageEmbeddings {
  id: Generated<string>;
  pageId: string;
  spaceId: string;
  modelName: string;
  modelDimensions: number;
  workspaceId: string;
  attachmentId: string;
  embedding: number[];
  chunkIndex: Generated<number>;
  chunkStart: Generated<number>;
  chunkLength: Generated<number>;
  metadata: Generated<Json>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  deletedAt: Timestamp | null;
}
