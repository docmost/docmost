import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres = require('postgres');
import {
  down,
  up,
} from '../../migrations/20261127T220208-attachment-diagram-type';

const databaseUrl = process.env.DIAGRAM_TEST_DATABASE_URL;

(databaseUrl ? it : it.skip)(
  'backfills only SVGs used as diagrams by their owning document',
  async () => {
    const db = new Kysely<any>({
      dialect: new PostgresJSDialect({
        postgres: postgres(databaseUrl, { max: 1 }),
      }),
    });
    try {
      await db.transaction().execute(async (trx) => {
        await sql`CREATE TEMP TABLE pages (id uuid, workspace_id uuid, content jsonb) ON COMMIT DROP`.execute(
          trx,
        );
        await sql`CREATE TEMP TABLE templates (LIKE pages) ON COMMIT DROP`.execute(
          trx,
        );
        await sql`CREATE TEMP TABLE attachments (
        id uuid PRIMARY KEY, page_id uuid, template_id uuid, workspace_id uuid,
        type text, file_ext text, file_name text, deleted_at timestamptz, ai_chat_id uuid
      ) ON COMMIT DROP`.execute(trx);
        const page = randomUUID();
        const template = randomUUID();
        const workspace = randomUUID();
        const file = (file_name: string) => ({
          id: randomUUID(),
          file_name,
          workspace_id: workspace,
          page_id: page,
          template_id: null as string | null,
          type: 'file',
          file_ext: '.svg',
        });
        const drawio = file('Topology.svg');
        const excalidraw = {
          ...file('Map.SVG'),
          page_id: null,
          template_id: template,
          file_ext: '.SVG',
        };
        const image = file('diagram.drawio.svg');
        const unused = file('diagram.excalidraw.svg');
        const shared = file('both.svg');
        const otherPage = {
          ...file('different-page.svg'),
          page_id: randomUUID(),
        };
        const otherWorkspace = {
          ...file('different-workspace.svg'),
          workspace_id: randomUUID(),
        };
        const pdf = { ...file('document.pdf'), file_ext: '.pdf' };
        const node = (type: string, attachment: { id: string }) => ({
          type,
          attrs: { attachmentId: attachment.id },
        });
        await trx
          .insertInto('attachments')
          .values([
            drawio,
            excalidraw,
            image,
            unused,
            shared,
            otherPage,
            otherWorkspace,
            pdf,
          ])
          .execute();
        await trx
          .insertInto('pages')
          .values({
            id: page,
            workspace_id: workspace,
            content: {
              type: 'doc',
              content: [
                { type: 'tableCell', content: [node('drawio', drawio)] },
                node('image', image),
                node('image', shared),
                node('drawio', shared),
                node('excalidraw', otherPage),
                node('drawio', otherWorkspace),
                node('drawio', pdf),
                {
                  type: 'paragraph',
                  attrs: { metadata: node('drawio', unused) },
                },
              ],
            },
          })
          .execute();
        await trx
          .insertInto('templates')
          .values({
            id: template,
            workspace_id: workspace,
            content: {
              type: 'doc',
              content: [node('excalidraw', excalidraw)],
            },
          })
          .execute();

        await up(trx);
        const rows = await trx
          .selectFrom('attachments')
          .select(['id', 'diagram_type'])
          .execute();
        expect(
          Object.fromEntries(rows.map((row) => [row.id, row.diagram_type])),
        ).toEqual({
          [drawio.id]: 'drawio',
          [excalidraw.id]: 'excalidraw',
          [image.id]: null,
          [unused.id]: null,
          [shared.id]: null,
          [otherPage.id]: null,
          [otherWorkspace.id]: null,
          [pdf.id]: null,
        });
        await down(trx);
        expect(
          await trx.selectFrom('attachments').select('id').execute(),
        ).toHaveLength(rows.length);
      });
    } finally {
      await db.destroy();
    }
  },
);
