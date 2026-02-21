import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../types/kysely.types';
import { sql } from 'kysely';
import { WorkspaceReleaseChannel } from '@docmost/db/types/entity.types';

export type ReleaseChannel = 'prod' | 'staging';

@Injectable()
export class WorkspaceReleaseChannelRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceReleaseChannel | undefined> {
    return this.db
      .selectFrom('workspaceReleaseChannel')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async getReleaseChannel(workspaceId: string): Promise<ReleaseChannel> {
    const row = await this.findByWorkspaceId(workspaceId);
    return (row?.releaseChannel as ReleaseChannel) ?? 'prod';
  }

  async upsertReleaseChannel(
    workspaceId: string,
    releaseChannel: ReleaseChannel,
    updatedBy?: string,
  ): Promise<WorkspaceReleaseChannel | undefined> {
    return this.db
      .insertInto('workspaceReleaseChannel')
      .values({
        workspaceId,
        releaseChannel,
        updatedBy: updatedBy ?? null,
      })
      .onConflict((oc) =>
        oc.column('workspaceId').doUpdateSet({
          releaseChannel,
          updatedBy: updatedBy ?? null,
          updatedAt: sql`now()`,
        }),
      )
      .returningAll()
      .executeTakeFirst();
  }
}
