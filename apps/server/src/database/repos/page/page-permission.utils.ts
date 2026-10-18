import { sql, SqlBool } from 'kysely';

// Aliases must be snake_case: they are referenced through sql.ref, which CamelCasePlugin rewrites.

// Space approval stays in force while it is being disabled.
export function spaceApprovalActiveSql(space: string) {
  const settings = sql.ref(`${space}.settings`);
  return sql<SqlBool>`(
    coalesce(${settings}->'approval'->>'enabled' = 'true', false)
    or coalesce(${settings}->'approval'->>'disabling' = 'true', false)
  )`;
}

// Approval-controlled page: non-base, with a qms row or in an approval space.
export function controlledPageSql(page: string) {
  return sql<SqlBool>`(
    not ${sql.ref(`${page}.isBase`)}
    and (
      exists (
        select 1 from page_verifications controlled_pv
        where controlled_pv.page_id = ${sql.ref(`${page}.id`)}
          and controlled_pv.type = 'qms'
      )
      or exists (
        select 1 from spaces controlled_sp
        where controlled_sp.id = ${sql.ref(`${page}.spaceId`)}
          and ${spaceApprovalActiveSql('controlled_sp')}
      )
    )
  )`;
}

// Approval-controlled page without a reader version.
export function unpublishedPageSql(page: string) {
  return sql<SqlBool>`(
    ${sql.ref(`${page}.readerVersionId`)} is null
    and ${controlledPageSql(page)}
  )`;
}
