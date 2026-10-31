import { DB } from '@docmost/db/types/db.js';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types.js';

export interface DbInterface extends DB {
  pageEmbeddings: PageEmbeddings;
}
