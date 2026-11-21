import { DB } from '@docmost/db/types/db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';
import { ConfluenceApiImports, ConfluenceImportUserKeys } from './custom.types';

export interface DbInterface extends DB {
  pageEmbeddings: PageEmbeddings;
  confluenceApiImports: ConfluenceApiImports;
  confluenceImportUserKeys: ConfluenceImportUserKeys;
}
