import { db } from './support/database';
import { seedAcyclicPageChain } from './support/page-hierarchy-fixtures';

describe('page hierarchy cycle integration harness', () => {
  it('inserts and reads an acyclic page chain through the test Kysely instance', async () => {
    const { root, child, grandchild } = await seedAcyclicPageChain();

    const pages = await db
      .selectFrom('pages')
      .select(['id', 'parentPageId', 'title'])
      .where('id', 'in', [root.id, child.id, grandchild.id])
      .orderBy('title')
      .execute();

    expect(pages).toEqual([
      { id: child.id, parentPageId: root.id, title: 'Child' },
      { id: grandchild.id, parentPageId: child.id, title: 'Grandchild' },
      { id: root.id, parentPageId: null, title: 'Root' },
    ]);
  });
});
