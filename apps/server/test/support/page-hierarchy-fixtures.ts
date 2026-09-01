import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { db } from './database';

export type PageFixture = {
  id: string;
  parentPageId: string | null;
  title: string;
};

type HierarchyContext = {
  workspaceId: string;
  spaceId: string;
};

async function seedWorkspaceAndSpace(): Promise<HierarchyContext> {
  const workspace = await db
    .insertInto('workspaces')
    .values({
      hostname: `cycle-test-${randomUUID()}`,
      name: 'Page hierarchy integration workspace',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const space = await db
    .insertInto('spaces')
    .values({
      name: 'Page hierarchy integration space',
      slug: `cycle-test-${randomUUID()}`,
      workspaceId: workspace.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return { spaceId: space.id, workspaceId: workspace.id };
}

async function insertPage(
  context: HierarchyContext,
  title: string,
  parentPageId: string | null = null,
): Promise<PageFixture> {
  const page = await db
    .insertInto('pages')
    .values({
      parentPageId,
      slugId: randomUUID(),
      spaceId: context.spaceId,
      title,
      workspaceId: context.workspaceId,
    })
    .returning(['id', 'parentPageId', 'title'])
    .executeTakeFirstOrThrow();

  return { id: page.id, parentPageId: page.parentPageId, title };
}

export async function seedAcyclicPageChain(): Promise<{
  root: PageFixture;
  child: PageFixture;
  grandchild: PageFixture;
}> {
  const context = await seedWorkspaceAndSpace();
  const root = await insertPage(context, 'Root');
  const child = await insertPage(context, 'Child', root.id);
  const grandchild = await insertPage(context, 'Grandchild', child.id);

  return { root, child, grandchild };
}

export async function seedSelfCycle(): Promise<{ self: PageFixture }> {
  const context = await seedWorkspaceAndSpace();
  const self = await insertPage(context, 'Self');

  await sql`UPDATE pages SET parent_page_id = ${self.id} WHERE id = ${self.id}`.execute(
    db,
  );

  return { self: { ...self, parentPageId: self.id } };
}

export async function seedTwoPageCycle(): Promise<{
  a: PageFixture;
  b: PageFixture;
}> {
  const context = await seedWorkspaceAndSpace();
  const a = await insertPage(context, 'A');
  const b = await insertPage(context, 'B', a.id);

  await sql`UPDATE pages SET parent_page_id = ${b.id} WHERE id = ${a.id}`.execute(
    db,
  );

  return {
    a: { ...a, parentPageId: b.id },
    b,
  };
}

export async function seedBranchingDescendantTree(): Promise<{
  root: PageFixture;
  firstChild: PageFixture;
  secondChild: PageFixture;
  grandchild: PageFixture;
}> {
  const context = await seedWorkspaceAndSpace();
  const root = await insertPage(context, 'Root');
  const firstChild = await insertPage(context, 'First child', root.id);
  const secondChild = await insertPage(context, 'Second child', root.id);
  const grandchild = await insertPage(context, 'Grandchild', firstChild.id);

  return { root, firstChild, secondChild, grandchild };
}
