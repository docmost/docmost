import { DB } from '@docmost/db/types/db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';
import {
  DocumentTasks,
  ReadingBatches,
  ReadingSnapshots,
  ReadingRecipients,
  CollaborationOutbox,
} from './collaboration.types';

export interface DbInterface extends DB {
  pageEmbeddings: PageEmbeddings;
  documentTasks: DocumentTasks;
  readingBatches: ReadingBatches;
  readingSnapshots: ReadingSnapshots;
  readingRecipients: ReadingRecipients;
  collaborationOutbox: CollaborationOutbox;
}
