import type { JSONContent } from '@tiptap/core';
import { validate as isUuid } from 'uuid';
import type { RecentlyUpdatedFilters } from './recently-updated';

type SpaceFilters = Pick<
  RecentlyUpdatedFilters,
  'scope' | 'spaceIds' | 'excludeSpaceIds'
>;

// Earlier saved blocks used selectors in the same field as space IDs.
export function upgradeRecentlyUpdatedSpaceFilters({
  spaces = [],
  excludeSpaces = [],
  spaceMatch = 'any',
}: Record<string, unknown>): SpaceFilters {
  const noMatches: SpaceFilters = {
    scope: 'spaces',
    spaceIds: [],
    excludeSpaceIds: [],
  };
  if (
    !Array.isArray(spaces) ||
    !spaces.every(
      (value) =>
        typeof value === 'string' &&
        (isUuid(value) || ['@all', '*', '@self'].includes(value.toLowerCase())),
    ) ||
    !Array.isArray(excludeSpaces) ||
    !excludeSpaces.every(isUuid) ||
    (spaceMatch !== 'any' && spaceMatch !== 'all')
  ) {
    return noMatches;
  }
  const included = new Set<string>(
    spaces.map((value: string) =>
      value === '*' ? '@all' : value.toLowerCase(),
    ),
  );
  const allSpaces = included.delete('@all');
  if (allSpaces && spaceMatch === 'any') {
    return { scope: 'workspace', spaceIds: [], excludeSpaceIds: excludeSpaces };
  }
  const current = included.delete('@self');
  if (
    (current && included.size) ||
    (spaceMatch === 'all' && included.size > 1)
  ) {
    return noMatches;
  }
  return {
    scope: included.size
      ? 'spaces'
      : current || !allSpaces
        ? 'current'
        : 'workspace',
    spaceIds: [...included],
    excludeSpaceIds: excludeSpaces,
  };
}

export function hasLegacyRecentlyUpdatedSpaces(
  attrs: Record<string, unknown>,
): boolean {
  return (
    typeof attrs === 'object' &&
    attrs !== null &&
    ['spaces', 'excludeSpaces', 'spaceMatch'].some((key) =>
      Object.hasOwn(attrs, key),
    )
  );
}

// Read older page, history and template JSON before the schema drops unknown attributes.
export function upgradeRecentlyUpdatedContent(node: JSONContent): JSONContent {
  if (
    node?.type === 'recentlyUpdated' &&
    hasLegacyRecentlyUpdatedSpaces(node.attrs)
  ) {
    const { spaces, excludeSpaces, spaceMatch, ...attrs } = node.attrs;
    const filters =
      attrs.scope === undefined
        ? upgradeRecentlyUpdatedSpaceFilters({
            spaces,
            excludeSpaces,
            spaceMatch,
          })
        : {};
    return { ...node, attrs: { ...attrs, ...filters } };
  }
  let content: JSONContent[] | undefined;
  if (!Array.isArray(node?.content)) return node;
  node.content.forEach((child, index) => {
    const upgraded = upgradeRecentlyUpdatedContent(child);
    if (upgraded === child) return;
    content ??= node.content.slice();
    content[index] = upgraded;
  });
  return content ? { ...node, content } : node;
}
