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

    // RFC 5987: use filename*=UTF-8''... for non-ASCII; keep a plain
    // ASCII fallback in filename=. Percent-encoding a name inside the
    // quoted-string filename= token is not decoded by browsers, so it
    // would land as e.g. "My%20Base.csv" on disk.
    const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, '_');
    reply.headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    reply.send(out);

    // Client aborts (tab close, cancel-download) close `out`. Without
    // an abort signal the row loop keeps pulling chunks from Postgres
    // long after the response is gone — on a 500k-row base that's
    // hundreds of useless round-trips.
    let aborted = false;
    out.once('close', () => {
      aborted = true;
    });

    try {
      for await (const chunk of this.baseRowRepo.streamByBaseId(baseId, {
        workspaceId,
        chunkSize: CHUNK_SIZE,
      })) {
        if (aborted) break;
        const ctx = await this.buildCtx(chunk, properties);

        for (const row of chunk) {
          if (aborted) break;
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
      // Headers are already flushed at this point — re-throwing would
      // trigger Nest's exception filter to try to send another
      // response, which Fastify rejects. Destroying the stringifier
      // cascades to `out` and signals EOF to the client.
      this.logger.error(`csv export failed base=${baseId}`, err);
      stringifier.destroy(err as Error);
    }
  }

  private async buildCtx(
    chunk: Array<{ cells: unknown; lastUpdatedById: string | null }>,
    properties: Array<{ id: string; type: string }>,
  ): Promise<CellCsvContext> {
    const ctx: CellCsvContext = {};

    const needsUsers = properties.some(
      (p) =>
        p.type === BasePropertyType.PERSON ||
        p.type === BasePropertyType.LAST_EDITED_BY,
    );

    if (needsUsers) {
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

      if (userIds.size > 0) {
        const rows = await this.db
          .selectFrom('users')
          .select(['id', 'name', 'email'])
          .where('id', 'in', Array.from(userIds))
          .execute();
        ctx.userNames = new Map(
          rows.map((u) => [u.id, u.name || u.email || '']),
        );
      }
    }

    const pagePropIds = properties
      .filter((p) => p.type === BasePropertyType.PAGE)
      .map((p) => p.id);

    if (pagePropIds.length > 0) {
      const pageIds = new Set<string>();
      for (const row of chunk) {
        const cells = (row.cells ?? {}) as Record<string, unknown>;
        for (const pid of pagePropIds) {
          const v = cells[pid];
          if (typeof v === 'string' && v.length > 0) pageIds.add(v);
        }
      }

      if (pageIds.size > 0) {
        const rows = await this.db
          .selectFrom('pages')
          .select(['id', 'title'])
          .where('id', 'in', Array.from(pageIds))
          .execute();
        ctx.pageTitles = new Map(rows.map((p) => [p.id, p.title ?? '']));
      }
    }

    return ctx;
  }
}
