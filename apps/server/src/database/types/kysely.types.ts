import { Kysely, Transaction } from 'kysely';
import { DbInterface } from '@docmost/db/types/db.interface';

export type KyselyDB = Kysely<DbInterface>;
export type KyselyTransaction = Transaction<DbInterface>;
