import type { RecentlyUpdatedAttributes } from "@docmost/editor-ext";
import { validate as isUuid } from "uuid";
import type { DocsSurface } from "@/features/public-space/components/docs/docs-surface-context";
import { flattenTreePreorder } from "@/features/public-space/utils/docs-tree";

export function publicRecentlyUpdatedPages(
  { treeData, getNodeUrl }: DocsSurface,
  { labels, spaces, limit }: RecentlyUpdatedAttributes,
) {
  if (!treeData?.length || labels.length) return [];

  // A published tree contains pages from one space. Its API omits private
  // space metadata (favorites and personal spaces) and labels.
  const spaceId = treeData[0].spaceId;
  const included: boolean[] = [];
  for (const token of spaces) {
    const signed = token.trim().toLowerCase();
    const sign = signed[0];
    const value = /^[+-]/.test(signed) ? signed.slice(1) : signed;
    const wildcard = ["@self", "@all", "*"].includes(value);
    if (!wildcard && !isUuid(value)) return [];
    const matches = wildcard || value === spaceId;
    if ((sign === "+" && !matches) || (sign === "-" && matches)) return [];
    if (sign !== "+" && sign !== "-") included.push(matches);
  }
  const hasRequired = spaces.some((token) => token.trim().startsWith("+"));
  if (!hasRequired && included.length && !included.some(Boolean)) return [];

  return flattenTreePreorder(treeData)
    .filter(
      (node) =>
        node.spaceId === spaceId &&
        Number.isFinite(new Date(node.updatedAt ?? NaN).getTime()),
    )
    .sort(
      (a, b) =>
        +new Date(b.updatedAt) - +new Date(a.updatedAt) ||
        b.value.localeCompare(a.value),
    )
    .slice(0, limit)
    .map((node) => ({
      id: node.value,
      title: node.name,
      icon: node.icon,
      url: getNodeUrl(node),
    }));
}
