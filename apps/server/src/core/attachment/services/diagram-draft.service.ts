import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { v7 as uuid7 } from 'uuid';
import type { MultipartFile } from '@fastify/multipart';
import type { KyselyDB } from '@docmost/db/types/kysely.types';
import { StorageService } from '../../../integrations/storage/storage.service';
import { streamMultipartFile } from '../../../common/helpers';

type DraftFile = { id: string; draftKey: string };

@Injectable()
export class DiagramDraftService {
  private readonly logger = new Logger(DiagramDraftService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly storage: StorageService,
  ) {}

  private path({ draftKey, id }: DraftFile) {
    const [workspaceId] = draftKey.split('/');
    return `${workspaceId}/diagram-drafts/${id}/draft.svg`;
  }

  async read(key: string) {
    const draft = await this.db
      .selectFrom('diagramDrafts')
      .select(['id', 'draftKey'])
      .where('draftKey', '=', key)
      .where('active', '=', true)
      .executeTakeFirst();
    return draft ? this.storage.readStream(this.path(draft)) : null;
  }

  async write(key: string, file: MultipartFile) {
    if (!file.filename.toLowerCase().endsWith('.svg')) {
      throw new BadRequestException('Diagrams must be SVG files');
    }
    const staged = { id: uuid7(), draftKey: key };
    // Register the object before streaming so an interrupted process leaves a cleanup record.
    await this.db.insertInto('diagramDrafts').values(staged).execute();
    try {
      await streamMultipartFile(file, (stream) =>
        this.storage.uploadStream(this.path(staged), stream),
      );
    } catch (err) {
      await this.remove(staged);
      throw err;
    }

    const previous = await this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(
        trx,
      );
      const old = await trx
        .updateTable('diagramDrafts')
        .set({ active: false })
        .where('draftKey', '=', key)
        .where('active', '=', true)
        .returning(['id', 'draftKey'])
        .executeTakeFirst();
      await trx
        .updateTable('diagramDrafts')
        .set({ active: true, updatedAt: new Date() })
        .where('id', '=', staged.id)
        .executeTakeFirstOrThrow();
      return old;
    });
    if (previous) await this.remove(previous);
  }

  async discard(key: string) {
    const draft = await this.db
      .updateTable('diagramDrafts')
      .set({ active: false })
      .where('draftKey', '=', key)
      .where('active', '=', true)
      .returning(['id', 'draftKey'])
      .executeTakeFirst();
    if (draft) await this.remove(draft);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expire() {
    const cutoff = sql<Date>`now() - interval '7 days'`;
    // Each object has a unique key, including replacements and interrupted uploads.
    const expired = await this.db
      .selectFrom('diagramDrafts')
      .select(['id', 'draftKey'])
      .where('updatedAt', '<', cutoff)
      .orderBy('updatedAt')
      .limit(500)
      .execute();
    for (const draft of expired) await this.remove(draft);
  }

  private async remove(draft: DraftFile) {
    try {
      const path = this.path(draft);
      if (await this.storage.exists(path)) await this.storage.delete(path);
      await this.db
        .deleteFrom('diagramDrafts')
        .where('id', '=', draft.id)
        .execute();
    } catch (error) {
      this.logger.warn(
        `Could not clean up diagram draft ${draft.id}: ${error}`,
      );
    }
  }
}
