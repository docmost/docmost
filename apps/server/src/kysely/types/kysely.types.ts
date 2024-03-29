import { DB } from './db';
import { Kysely, Transaction } from 'kysely';

export type KyselyDB = Kysely<DB>;
export type KyselyTransaction = Transaction<DB>;
