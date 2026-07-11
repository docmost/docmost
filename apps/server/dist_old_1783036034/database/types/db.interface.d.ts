import { DB } from '@docmost/db/types/db';
import { PageEmbeddings } from "./embeddings.types";
export interface DbInterface extends DB {
    pageEmbeddings: PageEmbeddings;
}
