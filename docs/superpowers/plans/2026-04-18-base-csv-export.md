# Base CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-streamed CSV export for a base's rows, triggered from a download button in the base toolbar.

**Architecture:** A new `/bases/export-csv` Nest controller route writes directly to the Fastify reply as `text/csv`. The service pipes `BaseRowRepo.streamByBaseId` (the existing keyset-paginated async generator used by type-conversion / cell-gc) through `csv-stringify` in streaming mode so memory stays flat for 100k-row bases. Cells are serialized per property type by a pure helper with a pre-built property index and a per-chunk user-name map (same pattern as `base-type-conversion.task.ts`). The client fetches the endpoint as a blob and hands it to `file-saver`, mirroring `exportPage` in `page-service.ts`.

**Tech Stack:** NestJS + Fastify (server), Kysely (db), `csv-stringify` (stream CSV encoder), React + Mantine (client), `file-saver` (download).

**Scope (v1):**
- Exports **all live rows** of the base (ignoring current view's filter / sort / column visibility). View-scoped export is a later follow-up.
- All properties (including hidden + system) in property-position order. Primary property first.
- Permission: same as reading the base (`SpaceCaslAction.Read` on `SpaceCaslSubject.Base`).
- UTF-8, RFC 4180 CSV, with BOM for Excel compatibility.
- Filename: `{sanitize(base.name)}.csv`.

**Non-goals (v1):** row selection export, filtered/sorted export, choosing columns, alternative formats (xlsx), background jobs. Only the current synchronous streamed export.

---

## File Structure

**New files:**
- `apps/server/src/core/base/export/cell-csv-serializer.ts` — pure per-type cell → string function.
- `apps/server/src/core/base/export/cell-csv-serializer.spec.ts` — unit tests for the serializer.
- `apps/server/src/core/base/services/base-csv-export.service.ts` — orchestrates streaming from repo → CSV stringifier → Fastify reply. Builds per-chunk user-name map for PERSON / LAST_EDITED_BY.
- `apps/server/src/core/base/dto/export-base.dto.ts` — `{ baseId: string }` DTO.

**Modified files:**
- `apps/server/src/core/base/controllers/base.controller.ts` — new `POST /bases/export-csv` handler (returns `FastifyReply`).
- `apps/server/src/core/base/base.module.ts` — register `BaseCsvExportService` as provider.
- `apps/server/package.json` — add `csv-stringify` dependency.
- `apps/client/src/features/base/services/base-service.ts` — new `exportBaseToCsv(baseId)` function.
- `apps/client/src/features/base/components/base-toolbar.tsx` — new `IconDownload` button that calls the export service.

---

## Task 1: Add `csv-stringify` dependency

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Install the dependency**

Run from repo root:
```bash
pnpm --filter server add csv-stringify@^6
```

Expected: `csv-stringify` appears under `dependencies` in `apps/server/package.json` (latest v6 or newer).

- [ ] **Step 2: Verify server still builds**

```bash
pnpm nx run server:build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore(server): add csv-stringify dependency"
```

---

## Task 2: Pure cell-to-CSV serializer — failing test first

**Files:**
- Create: `apps/server/src/core/base/export/cell-csv-serializer.spec.ts`

Contract the serializer must satisfy:

| Property type | Input | Output |
|---|---|---|
| `text`, `url`, `email` | `"hi"` | `"hi"` |
| `number` | `42` | `"42"` |
| `checkbox` | `true` / `false` / `null` | `"true"` / `"false"` / `""` |
| `date` | `"2026-04-18T12:00:00Z"` | same ISO string |
| `select` / `status` | choice-uuid | choice name from `typeOptions.choices` |
| `multiSelect` | `[uuid1, uuid2]` | `"Name 1; Name 2"` (in given order) |
| `person` | `uuid` or `[uuid, ...]` | `"Alice; Bob"` from `userNames` map; fallback to `""` when missing |
| `file` | `[{fileName: "a.pdf"}, {fileName: "b.png"}]` | `"a.pdf; b.png"` |
| `createdAt` | `row.createdAt` (ISO) | same |
| `lastEditedAt` | `row.updatedAt` (ISO) | same |
| `lastEditedBy` | `row.lastUpdatedById` | resolved name from map or `""` |
| any | `null` / `undefined` | `""` |

- [ ] **Step 1: Write the failing spec**

Create `apps/server/src/core/base/export/cell-csv-serializer.spec.ts`:

```ts
import { serializeCellForCsv } from './cell-csv-serializer';
import { BasePropertyType } from '../base.schemas';

const p = (type: string, typeOptions: unknown = {}) => ({
  id: 'prop-1',
  type: type as any,
  typeOptions,
});

describe('serializeCellForCsv', () => {
  const userNames = new Map([
    ['u1', 'Alice'],
    ['u2', 'Bob'],
  ]);

  it('returns empty string for null/undefined', () => {
    expect(serializeCellForCsv(p(BasePropertyType.TEXT), null, {})).toBe('');
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), undefined, {})).toBe('');
  });

  it('stringifies text/url/email as-is', () => {
    expect(serializeCellForCsv(p(BasePropertyType.TEXT), 'hi', {})).toBe('hi');
    expect(serializeCellForCsv(p(BasePropertyType.URL), 'https://x', {})).toBe('https://x');
    expect(serializeCellForCsv(p(BasePropertyType.EMAIL), 'a@b.com', {})).toBe('a@b.com');
  });

  it('stringifies number', () => {
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), 42, {})).toBe('42');
    expect(serializeCellForCsv(p(BasePropertyType.NUMBER), 0, {})).toBe('0');
  });

  it('renders checkbox as true/false', () => {
    expect(serializeCellForCsv(p(BasePropertyType.CHECKBOX), true, {})).toBe('true');
    expect(serializeCellForCsv(p(BasePropertyType.CHECKBOX), false, {})).toBe('false');
  });

  it('resolves select/status choice name', () => {
    const prop = p(BasePropertyType.SELECT, {
      choices: [
        { id: 'c1', name: 'Red', color: 'red' },
        { id: 'c2', name: 'Green', color: 'green' },
      ],
    });
    expect(serializeCellForCsv(prop, 'c1', {})).toBe('Red');
    expect(serializeCellForCsv(prop, 'unknown', {})).toBe('');
  });

  it('joins multiSelect names with "; " preserving order', () => {
    const prop = p(BasePropertyType.MULTI_SELECT, {
      choices: [
        { id: 'c1', name: 'A', color: 'red' },
        { id: 'c2', name: 'B', color: 'blue' },
      ],
    });
    expect(serializeCellForCsv(prop, ['c2', 'c1'], {})).toBe('B; A');
  });

  it('resolves person scalar and array', () => {
    const prop = p(BasePropertyType.PERSON);
    expect(serializeCellForCsv(prop, 'u1', { userNames })).toBe('Alice');
    expect(serializeCellForCsv(prop, ['u1', 'u2', 'missing'], { userNames })).toBe(
      'Alice; Bob',
    );
  });

  it('joins file names from cell payload', () => {
    const prop = p(BasePropertyType.FILE);
    expect(
      serializeCellForCsv(
        prop,
        [
          { id: 'f1', fileName: 'a.pdf' },
          { id: 'f2', fileName: 'b.png' },
        ],
        {},
      ),
    ).toBe('a.pdf; b.png');
  });

  it('dates pass through as ISO strings', () => {
    const iso = '2026-04-18T12:00:00.000Z';
    expect(serializeCellForCsv(p(BasePropertyType.DATE), iso, {})).toBe(iso);
  });

  it('lastEditedBy resolves via userNames', () => {
    const prop = p(BasePropertyType.LAST_EDITED_BY);
    expect(serializeCellForCsv(prop, 'u2', { userNames })).toBe('Bob');
    expect(serializeCellForCsv(prop, 'missing', { userNames })).toBe('');
  });
});
```

- [ ] **Step 2: Run spec — verify it fails**

```bash
pnpm --filter server test -- cell-csv-serializer.spec
```

Expected: FAIL — `Cannot find module './cell-csv-serializer'`.

---

## Task 3: Implement `cell-csv-serializer.ts`

**Files:**
- Create: `apps/server/src/core/base/export/cell-csv-serializer.ts`

- [ ] **Step 1: Implement the serializer**

```ts
import { BasePropertyType, BasePropertyTypeValue } from '../base.schemas';

export type CellCsvContext = {
  userNames?: Map<string, string>;
};

type PropertyLike = {
  id: string;
  type: BasePropertyTypeValue | string;
  typeOptions?: unknown;
};

function resolveChoiceName(typeOptions: unknown, id: unknown): string {
  if (!typeOptions || typeof typeOptions !== 'object') return '';
  const choices = (typeOptions as any).choices;
  if (!Array.isArray(choices)) return '';
  const match = choices.find((c: any) => c?.id === id);
  return typeof match?.name === 'string' ? match.name : '';
}

function resolveUser(id: unknown, ctx: CellCsvContext): string {
  if (typeof id !== 'string') return '';
  return ctx.userNames?.get(id) ?? '';
}

export function serializeCellForCsv(
  property: PropertyLike,
  value: unknown,
  ctx: CellCsvContext,
): string {
  if (value === null || value === undefined) return '';

  switch (property.type) {
    case BasePropertyType.TEXT:
    case BasePropertyType.URL:
    case BasePropertyType.EMAIL:
      return String(value);

    case BasePropertyType.NUMBER:
      return typeof value === 'number' ? String(value) : String(value ?? '');

    case BasePropertyType.CHECKBOX:
      return value === true ? 'true' : 'false';

    case BasePropertyType.DATE:
    case BasePropertyType.CREATED_AT:
    case BasePropertyType.LAST_EDITED_AT:
      if (value instanceof Date) return value.toISOString();
      return String(value);

    case BasePropertyType.SELECT:
    case BasePropertyType.STATUS:
      return resolveChoiceName(property.typeOptions, value);

    case BasePropertyType.MULTI_SELECT:
      if (!Array.isArray(value)) return '';
      return value
        .map((v) => resolveChoiceName(property.typeOptions, v))
        .filter((s) => s.length > 0)
        .join('; ');

    case BasePropertyType.PERSON: {
      const ids = Array.isArray(value) ? value : [value];
      return ids
        .map((id) => resolveUser(id, ctx))
        .filter((s) => s.length > 0)
        .join('; ');
    }

    case BasePropertyType.FILE:
      if (!Array.isArray(value)) return '';
      return value
        .map((f: any) =>
          f && typeof f === 'object' && typeof f.fileName === 'string'
            ? f.fileName
            : '',
        )
        .filter((s) => s.length > 0)
        .join('; ');

    case BasePropertyType.LAST_EDITED_BY:
      return resolveUser(value, ctx);

    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
```

- [ ] **Step 2: Run spec — verify it passes**

```bash
pnpm --filter server test -- cell-csv-serializer.spec
```

Expected: PASS (11 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/base/export/cell-csv-serializer.ts apps/server/src/core/base/export/cell-csv-serializer.spec.ts
git commit -m "feat(base): add csv cell serializer with per-type rules"
```

---

## Task 4: Export DTO

**Files:**
- Create: `apps/server/src/core/base/dto/export-base.dto.ts`

- [ ] **Step 1: Write the DTO**

```ts
import { IsUUID } from 'class-validator';

export class ExportBaseCsvDto {
  @IsUUID()
  baseId: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/base/dto/export-base.dto.ts
git commit -m "feat(base): add export base csv dto"
```

---

## Task 5: `BaseCsvExportService` — streams rows through `csv-stringify`

**Files:**
- Create: `apps/server/src/core/base/services/base-csv-export.service.ts`

**Design notes:**
- Sync values are pushed to a `csv-stringify` `Stringifier` stream. The stream is `pipe`d to `FastifyReply.raw` (Fastify's underlying Node http response).
- Per chunk (from `streamByBaseId`, chunkSize 1000):
  1. Collect all user IDs referenced by PERSON cells + all `lastUpdatedById` values.
  2. One `SELECT id, name, email FROM users WHERE id IN (...)` per chunk. Build `Map<userId, displayName>`.
  3. For each row, for each property in order, run `serializeCellForCsv`. `push` the record array into the stringifier.
- Header row: property names in property-position order. Primary property is first because properties are already sorted by `position`.
- Column for system types (`createdAt` / `lastEditedAt` / `lastEditedBy`): value pulled from the row column, not cells.
- BOM: write `\ufeff` to the raw socket before the stream pipe so Excel auto-detects UTF-8.

- [ ] **Step 1: Implement the service**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/base/services/base-csv-export.service.ts
git commit -m "feat(base): add streaming csv export service"
```

---

## Task 6: Register service in module

**Files:**
- Modify: `apps/server/src/core/base/base.module.ts`

- [ ] **Step 1: Add `BaseCsvExportService` to providers**

Add import:
```ts
import { BaseCsvExportService } from './services/base-csv-export.service';
```

Add to `providers` array (no need to export — only the controller uses it).

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/base/base.module.ts
git commit -m "feat(base): register csv export service in module"
```

---

## Task 7: Controller route `POST /bases/export-csv`

**Files:**
- Modify: `apps/server/src/core/base/controllers/base.controller.ts`

- [ ] **Step 1: Add handler**

Follow the exact precedent in `apps/server/src/integrations/export/export.controller.ts:47-109` (Fastify reply injection + permission check pattern) and the Read permission check pattern from the existing `info` handler in this controller.

```ts
// Add to constructor args:
private readonly baseCsvExportService: BaseCsvExportService,

// Imports:
import { FastifyReply } from 'fastify';
import { Res } from '@nestjs/common';
import { ExportBaseCsvDto } from '../dto/export-base.dto';
import { BaseCsvExportService } from '../services/base-csv-export.service';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

// Handler:
@HttpCode(HttpStatus.OK)
@Post('export-csv')
async exportCsv(
  @Body() dto: ExportBaseCsvDto,
  @AuthUser() user: User,
  @AuthWorkspace() workspace: Workspace,
  @Res() res: FastifyReply,
) {
  const base = await this.baseRepo.findById(dto.baseId);
  if (!base) {
    throw new NotFoundException('Base not found');
  }

  const ability = await this.spaceAbility.createForUser(user, base.spaceId);
  if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Base)) {
    throw new ForbiddenException();
  }

  await this.baseCsvExportService.streamBaseAsCsv(
    dto.baseId,
    workspace.id,
    res,
  );
}
```

- [ ] **Step 2: Build to verify wiring**

```bash
pnpm nx run server:build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/base/controllers/base.controller.ts
git commit -m "feat(base): add csv export http endpoint"
```

---

## Task 8: Manual server smoke test — USER-DRIVEN

> ⚠️ **Do not run `pnpm dev` as an agent.** Per `CLAUDE.md`, the agent builds but does not launch. Hand off to the user with the instructions below; resume the plan at Task 9 after the user confirms the curl succeeds.

- [ ] **Step 1: Ask the user to start the dev servers (`pnpm dev`) and open the app**

- [ ] **Step 2: Ask the user to run this curl, replacing `<BASE_ID>` and `<TOKEN>`**

Get a session cookie by logging into the client at http://localhost:3000, then grab `authToken` from DevTools → Application → Cookies.

```bash
curl -v -X POST http://localhost:3001/api/bases/export-csv \
  -H "Content-Type: application/json" \
  -H "Cookie: authToken=<TOKEN>" \
  -d '{"baseId": "<BASE_ID>"}' \
  --output /tmp/base-export.csv

head -5 /tmp/base-export.csv
wc -l /tmp/base-export.csv
```

Expected:
- `Content-Disposition: attachment; filename="..."` in response headers.
- First bytes of the file are the UTF-8 BOM (`efbbbf`) — check with `xxd /tmp/base-export.csv | head -1`.
- Header row contains property names.
- Line count ≈ live row count + 1.
- Opens cleanly in `less /tmp/base-export.csv` (no JSON blobs, no raw UUIDs for select / person / file).

If the base has a PERSON column, confirm it renders the user's name, not a UUID.

---

## Task 9: Client service function

**Files:**
- Modify: `apps/client/src/features/base/services/base-service.ts`

- [ ] **Step 1: Add `exportBaseToCsv`**

Mirror `exportPage` in `apps/client/src/features/page/services/page-service.ts:116-135`:

```ts
import { saveAs } from "file-saver";

export async function exportBaseToCsv(baseId: string): Promise<void> {
  const req = await api.post(
    "/bases/export-csv",
    { baseId },
    { responseType: "blob" },
  );

  const header = req?.headers["content-disposition"] ?? "";
  const match = header.match(/filename="?([^"]+)"?/);
  let fileName = match ? match[1] : "base.csv";
  try {
    fileName = decodeURIComponent(fileName);
  } catch {
    // fallback to raw filename
  }

  saveAs(req.data, fileName);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/features/base/services/base-service.ts
git commit -m "feat(base): add client csv export service call"
```

---

## Task 10: Toolbar export button

**Files:**
- Modify: `apps/client/src/features/base/components/base-toolbar.tsx`

- [ ] **Step 1: Wire the button**

Add imports:
```tsx
import { IconDownload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { exportBaseToCsv } from "@/features/base/services/base-service";
```

Add a handler inside the component:
```tsx
const [exporting, setExporting] = useState(false);
const handleExport = useCallback(async () => {
  if (exporting) return;
  setExporting(true);
  try {
    await exportBaseToCsv(base.id);
  } catch (err) {
    notifications.show({
      color: "red",
      message: t("Failed to export CSV"),
    });
  } finally {
    setExporting(false);
  }
}, [base.id, exporting, t]);
```

Insert the button inside `<div className={classes.toolbarRight}>` — place it before the filter/sort/fields group (leftmost of the right cluster):

```tsx
<Tooltip label={t("Export CSV")}>
  <ActionIcon
    variant="subtle"
    size="sm"
    color="gray"
    loading={exporting}
    onClick={handleExport}
  >
    <IconDownload size={16} />
  </ActionIcon>
</Tooltip>
```

- [ ] **Step 2: Build client**

```bash
pnpm nx run client:build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/base/components/base-toolbar.tsx
git commit -m "feat(base): add csv export button to base toolbar"
```

---

## Task 11: End-to-end UI smoke test — USER-DRIVEN

> ⚠️ **Do not run `pnpm dev` as an agent.** Ask the user to verify in their own browser session; resume at Task 12 after confirmation.

- [ ] **Step 1: Ask the user to open a base in the browser (dev server already running from Task 8)**

Navigate to a base with ≥ 1 row of each property type (or create cells manually: text, select, multi-select, person, file, checkbox, number, date).

- [ ] **Step 2: Click the download icon in the toolbar**

Expected:
- Button shows loading spinner briefly.
- Browser downloads a `.csv` named after the base.
- CSV opens in Excel / Numbers / Google Sheets with correct column headers.
- Select, multi-select, person, and file columns render names (not UUIDs).
- No console errors in either tab.

- [ ] **Step 3: Test an empty base**

Open a brand-new base (only primary property, no rows). Click export.

Expected: file contains just the header row + BOM. No error.

- [ ] **Step 4: Test permission**

As a user without access to the space, hit the endpoint (or simulate by setting user in session). Expected: 403.

---

## Task 12: Final commit + handoff

- [ ] **Step 1: Verify branch is clean and all commits are on the branch**

```bash
git status
git log --oneline main..HEAD
```

Expected: clean working tree, 8 commits (Tasks 1, 3, 4, 5, 6, 7, 9, 10).

- [ ] **Step 2: Open the `superpowers:finishing-a-development-branch` skill to decide on merge/PR**

---

## Follow-ups (out of scope for v1)

- Export respecting current view (filter / sort / column visibility / column order).
- Export only selected rows (wired into `selection-action-bar.tsx`).
- Format-aware number rendering (currency, percent, progress).
- Configurable date format (respect view/base locale).
- Large-export BullMQ job + email download link for very large bases.
- Alternative formats: JSON, XLSX.
