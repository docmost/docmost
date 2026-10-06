import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { dbOrTx } from '@docmost/db/utils';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  InsertableLdapIdentity,
  LdapIdentity,
} from '@docmost/db/types/entity.types';

@Injectable()
export class LdapIdentityRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findBySubjectId(
    workspaceId: string,
    subjectId: string,
    trx?: KyselyTransaction,
  ): Promise<LdapIdentity | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('ldapIdentities')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('subjectId', '=', subjectId)
      .executeTakeFirst();
  }

  async insertIdentity(
    identity: InsertableLdapIdentity,
    trx?: KyselyTransaction,
  ): Promise<LdapIdentity> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('ldapIdentities')
      .values(identity)
      .returningAll()
      .executeTakeFirst();
  }

  async lockForProvisioning(
    workspaceId: string,
    subjectId: string,
    email: string,
    trx: KyselyTransaction,
  ): Promise<void> {
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`ldap-subject:${workspaceId}:${subjectId}`}, 0)
      )
    `.execute(trx);
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`ldap-email:${workspaceId}:${email.toLowerCase()}`}, 0)
      )
    `.execute(trx);
  }
}