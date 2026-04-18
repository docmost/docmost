import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { stringify } from 'csv-stringify';
import { FastifyReply } from 'fastify';
import { PassThrough } from 'node:stream';
import { sanitize } from 'sanitize-filename-ts';
import {
  BasePropertyType,
  BasePropertyTypeValue,
} from '../base.schemas';
import {
  CellCsvContext,
  serializeCellForCsv,
} from '../export/cell-csv-serializer';

const CHUNK_SIZE = 1000;

@Injectable()
export class BaseCsvExportService {
  private readonly logger = new Logger(BaseCsvExportService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRepo: BaseRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  async streamBaseAsCsv(
    baseId: string,
    workspaceId: string,
    reply: FastifyReply,
  ): Promise<void> {
    const base = await this.baseRepo.findById(baseId);
    if (!base || base.workspaceId !== workspaceId) {
      throw new NotFoundException('Base not found');
    }

    const properties = await this.basePropertyRepo.findByBaseId(baseId);

    const fileName = sanitize(base.name || 'base') + '.csv';

    const stringifier = stringify({
      header: true,
      columns: properties.map((p) => ({ key: p.id, header: p.name })),
    });

    // Prepend UTF-8 BOM so Excel auto-detects encoding, then pipe the
    // CSV stream through. Using a PassThrough instead of `reply.raw`
    // keeps us inside Fastify's managed reply lifecycle — backpressure
    // is handled by the pipe, matching the existing `/spaces/export`
    // pattern (stream handed to `res.send`).
    const out = new PassThrough();
    out.write('\ufeff');

    stringifier.on('error', (err) => {
      this.logger.error('csv stringifier error', err);
      out.destroy(err);
    });
    stringifier.pipe(out);

    reply.headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="' + encodeURIComponent(fileName) + '"',
    });
    reply.send(out);

    try {
      for await (const chunk of this.baseRowRepo.streamByBaseId(baseId, {
        workspaceId,
        chunkSize: CHUNK_SIZE,
      })) {
        const ctx = await this.buildCtx(chunk, properties);

        for (const row of chunk) {
          const record: Record<string, string> = {};
          const cells = (row.cells ?? {}) as Record<string, unknown>;

          for (const prop of properties) {
            const type = prop.type as BasePropertyTypeValue;
            let value: unknown;
            if (type === BasePropertyType.CREATED_AT) {
              value = row.createdAt;
            } else if (type === BasePropertyType.LAST_EDITED_AT) {
              value = row.updatedAt;
            } else if (type === BasePropertyType.LAST_EDITED_BY) {
              value = row.lastUpdatedById;
            } else {
              value = cells[prop.id];
            }
            record[prop.id] = serializeCellForCsv(prop, value, ctx);
          }

          // Pipe handles backpressure internally, but honor the
          // stringifier's `write() === false` to avoid unbounded
          // internal buffering on very large bases.
          if (!stringifier.write(record)) {
            await new Promise<void>((resolve) =>
              stringifier.once('drain', resolve),
            );
          }
        }
      }

      stringifier.end();
    } catch (err) {
      this.logger.error(`csv export failed base=${baseId}`, err);
      stringifier.destroy(err as Error);
      throw err;
    }
  }

  private async buildCtx(
    chunk: Array<{ cells: unknown; lastUpdatedById: string | null }>,
    properties: Array<{ id: string; type: string }>,
  ): Promise<CellCsvContext> {
    const needsUsers = properties.some(
      (p) =>
        p.type === BasePropertyType.PERSON ||
        p.type === BasePropertyType.LAST_EDITED_BY,
    );
    if (!needsUsers) return {};

    const userIds = new Set<string>();
    const personPropIds = properties
      .filter((p) => p.type === BasePropertyType.PERSON)
      .map((p) => p.id);

    for (const row of chunk) {
      if (row.lastUpdatedById) userIds.add(row.lastUpdatedById);
      const cells = (row.cells ?? {}) as Record<string, unknown>;
      for (const pid of personPropIds) {
        const v = cells[pid];
        if (typeof v === 'string') userIds.add(v);
        else if (Array.isArray(v)) {
          for (const id of v) if (typeof id === 'string') userIds.add(id);
        }
      }
    }

    if (userIds.size === 0) return {};

    const rows = await this.db
      .selectFrom('users')
      .select(['id', 'name', 'email'])
      .where('id', 'in', Array.from(userIds))
      .execute();

    return {
      userNames: new Map(rows.map((u) => [u.id, u.name || u.email || ''])),
    };
  }
}
