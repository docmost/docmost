import { ConflictException } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { ClsServiceManager } from 'nestjs-cls';
import { TemplateEditorMiddleware } from '../../../common/middlewares/template-editor.middleware';
import { TemplateRepo } from './template.repo';

const paragraph = {
  type: 'paragraph',
  content: [
    { type: 'text', text: 'Owner: ' },
    { type: 'templatePlaceholder', attrs: { hint: 'Enter a name' } },
  ],
};
const template = { id: 't1', content: { type: 'doc', content: [paragraph] } };

function templateRequest(action: string, version?: string, affectedRows = 1) {
  const cls = ClsServiceManager.getClsService();
  const query = jest.fn(async (sql: string) =>
    sql.startsWith('update')
      ? { command: 'UPDATE', rowCount: affectedRows, rows: [] }
      : { command: 'SELECT', rowCount: 1, rows: [template] },
  );
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: {
        connect: async () => ({ query, release() {} }),
        end: async () => {},
      } as any,
    }),
  });
  const repo = new TemplateRepo(db, cls);
  const req = {
    originalUrl: `/api/templates/${action}`,
    headers: version ? { 'x-docmost-editor-schema': version } : {},
  };
  const run = <T>(fn: () => T) =>
    cls.run(() => {
      new TemplateEditorMiddleware(cls).use(req as any, null, () => {});
      return fn();
    });
  return { query, repo, run };
}

it('keeps real template text readable by old clients and instructions intact for current authors', async () => {
  const preview = async (version?: string) => {
    const { repo, run } = templateRequest('info', version);
    return run(() => repo.findById('t1', 'w1', { includeContent: true }));
  };
  expect((await preview()).content).toEqual({
    type: 'doc',
    content: [{ type: 'paragraph', content: [paragraph.content[0]] }],
  });
  expect((await preview('1')).content).toEqual(template.content);
});

it.each(['apply', 'use'])(
  'requires a reload before a stale client can %s a template with instructions',
  async (action) => {
    const { repo, run } = templateRequest(action);
    await expect(
      run(() => repo.findById('t1', 'w1', { includeContent: true })),
    ).rejects.toThrow(ConflictException);
  },
);

it('checks the stored template in the update itself, even when a legacy author submits an empty document', async () => {
  const { repo, run, query } = templateRequest('update', undefined, 0);
  await expect(
    run(() =>
      repo.updateTemplate(
        { content: { type: 'doc', content: [] } },
        't1',
        'w1',
      ),
    ),
  ).rejects.toThrow(ConflictException);
  expect(query.mock.calls[0][0]).toMatch(
    /update "templates".*where.*content @\?.*templatePlaceholder/,
  );
});

it('allows guarded updates on compatible templates and current authors to remove the final instruction', async () => {
  for (const version of [undefined, '1']) {
    const { repo, run, query } = templateRequest('update', version);
    await run(() =>
      repo.updateTemplate(
        { content: { type: 'doc', content: [] } },
        't1',
        'w1',
      ),
    );
    expect(query.mock.calls[0][0].includes('content @?')).toBe(!version);
  }
});
