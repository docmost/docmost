import { Injectable, Logger } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BaseRow } from '@docmost/db/types/entity.types';
import { BasePropertyType } from '../base.schemas';
import { buildColumnSpecs } from './column-types';
import { ColumnSpec, LoadedCollection } from './query-cache.types';

// System property type → DuckDB system column name (snake_case). Mirrors
// the mapping in duckdb-query-builder.ts.
const SYSTEM_PROPERTY_COLUMN: Record<string, keyof BaseRow> = {
  [BasePropertyType.CREATED_AT]: 'createdAt',
  [BasePropertyType.LAST_EDITED_AT]: 'updatedAt',
  [BasePropertyType.LAST_EDITED_BY]: 'lastUpdatedById',
};

@Injectable()
export class CollectionLoader {
  private readonly logger = new Logger(CollectionLoader.name);

  constructor(
    private readonly baseRepo: BaseRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  async load(baseId: string, workspaceId: string): Promise<LoadedCollection> {
    const base = await this.baseRepo.findById(baseId);
    if (!base) {
      throw new Error(`Base ${baseId} not found`);
    }
    const schemaVersion = (base as any).schemaVersion ?? 1;

    const properties = await this.basePropertyRepo.findByBaseId(baseId);
    const specs = buildColumnSpecs(properties);

    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();

    const ddl = `CREATE TABLE rows (${specs
      .map((s) => `${quoteIdent(s.column)} ${s.ddlType}`)
      .join(', ')}, PRIMARY KEY (${quoteIdent('id')}))`;
    await connection.run(ddl);

    const appender = await connection.createAppender('rows');

    let rowCount = 0;
    for await (const chunk of this.baseRowRepo.streamByBaseId(baseId, {
      workspaceId,
      chunkSize: 5000,
    })) {
      for (const row of chunk) {
        for (const spec of specs) {
          const raw = readFromRow(row, spec);
          if (raw == null) {
            appender.appendNull();
            continue;
          }
          switch (spec.ddlType) {
            case 'VARCHAR':
              appender.appendVarchar(String(raw));
              break;
            case 'DOUBLE': {
              const n = Number(raw);
              if (Number.isNaN(n)) {
                this.logger.debug(
                  `Malformed number for ${spec.column} on row ${row.id}`,
                );
                appender.appendNull();
                break;
              }
              appender.appendDouble(n);
              break;
            }
            case 'BOOLEAN':
              appender.appendBoolean(Boolean(raw));
              break;
            case 'TIMESTAMPTZ': {
              const d = raw instanceof Date ? raw : new Date(String(raw));
              if (Number.isNaN(d.getTime())) {
                this.logger.debug(
                  `Malformed timestamp for ${spec.column} on row ${row.id}`,
                );
                appender.appendNull();
                break;
              }
              appender.appendVarchar(d.toISOString());
              break;
            }
            case 'JSON':
              appender.appendVarchar(JSON.stringify(raw));
              break;
          }
        }
        appender.endRow();
        rowCount++;
      }
    }
    appender.flushSync();
    appender.closeSync();

    for (const spec of specs) {
      if (!spec.indexable) continue;
      const safe = spec.column.replace(/[^a-zA-Z0-9_]/g, '_');
      await connection.run(
        `CREATE INDEX ${quoteIdent(`idx_${safe}`)} ON rows (${quoteIdent(spec.column)})`,
      );
    }

    this.logger.debug(
      `Loaded ${rowCount} rows for base ${baseId} (schemaVersion=${schemaVersion})`,
    );

    return {
      baseId,
      schemaVersion,
      columns: specs,
      instance,
      connection,
      lastAccessedAt: Date.now(),
    };
  }
}

function readFromRow(row: BaseRow, spec: ColumnSpec): unknown {
  // System columns
  switch (spec.column) {
    case 'id':
      return row.id;
    case 'base_id':
      return row.baseId;
    case 'workspace_id':
      return row.workspaceId;
    case 'creator_id':
      return row.creatorId;
    case 'position':
      return row.position;
    case 'created_at':
      return row.createdAt;
    case 'updated_at':
      return row.updatedAt;
    case 'last_updated_by_id':
      return row.lastUpdatedById;
    case 'deleted_at':
      return null; // loader only inserts live rows
    case 'search_text':
      return ''; // search stays on Postgres in v1
  }

  // User-defined columns: look up by property id
  const prop = spec.property;
  if (!prop) return null;

  const sysColumn = SYSTEM_PROPERTY_COLUMN[prop.type];
  if (sysColumn) return (row as any)[sysColumn];

  const cells = (row.cells as Record<string, unknown> | null) ?? {};
  return cells[prop.id] ?? null;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
