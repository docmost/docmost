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

// Approval-controlled page (non-base, with a qms row or in an approval space) without a reader version.
export function unpublishedPageSql(page: string) {
  return sql<SqlBool>`(
    ${sql.ref(`${page}.readerVersionId`)} is null
    and not ${sql.ref(`${page}.isBase`)}
    and (
      exists (
        select 1 from page_verifications unpublished_pv
        where unpublished_pv.page_id = ${sql.ref(`${page}.id`)}
          and unpublished_pv.type = 'qms'
      )
      or exists (
        select 1 from spaces unpublished_sp
        where unpublished_sp.id = ${sql.ref(`${page}.spaceId`)}
          and ${spaceApprovalActiveSql('unpublished_sp')}
      )
    )
  )`;
}
