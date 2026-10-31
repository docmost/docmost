import { Kysely, Transaction } from 'kysely';
import { DbInterface } from '@docmost/db/types/db.interface.js';

export type KyselyDB = Kysely<DbInterface>;
export type KyselyTransaction = Transaction<DbInterface>;
