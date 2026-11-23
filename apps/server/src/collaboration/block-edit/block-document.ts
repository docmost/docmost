import type { Node } from '@tiptap/pm/model';

export function documentInsertion(
  doc: Node,
  nodes: Node[],
  prepend: boolean,
): { index: number; footnotesAt?: number } | string {
  const existing =
    doc.lastChild?.type.name === 'footnotes' ? doc.lastChild : undefined;
  const incoming = nodes.find((node) => node.type.name === 'footnotes');
  if (incoming && (existing || incoming !== nodes[nodes.length - 1])) {
    return 'A page can only have one footnotes list at the end. Edit its existing list to change definitions.';
  }

  const references: string[] = [];
  const collect = (node: Node) => {
    if (node.type.name === 'footnoteReference')
      references.push(node.attrs['data-id']);
  };
  for (const node of nodes) node.descendants(collect);
  if (incoming || references.length) {
    const introduced = new Set(references);
    doc.descendants(collect);
    const counts = new Map<string, number>();
    for (const id of references) counts.set(id, (counts.get(id) ?? 0) + 1);
    const definitions =
      (incoming ?? existing)?.children.map((node) => node.attrs['data-id']) ??
      [];
    const ids = new Set(definitions);
    const required = incoming ? new Set(references) : introduced;
    if (
      definitions.length !== ids.size ||
      [...required].some((id) => !id || !ids.has(id) || counts.get(id) !== 1) ||
      (incoming && definitions.some((id) => !id || counts.get(id) !== 1))
    ) {
      return 'Each added footnote must have a unique reference and matching definition with the same data-id.';
    }
  }
  const index = prepend ? 0 : doc.childCount - (existing ? 1 : 0);
  return prepend && incoming && doc.childCount
    ? { index, footnotesAt: doc.childCount }
    : { index };
}
