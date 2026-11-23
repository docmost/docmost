import { STATUS_COLORS, type StatusColor } from '@docmost/editor-ext';
import type { Node } from '@tiptap/pm/model';
import * as Y from 'yjs';
import type { StatusSplice } from './block-edits.types';

export const isStatusColor = (value: unknown): value is StatusColor =>
  STATUS_COLORS.some((color) => color === value);

export function statusSplice(
  block: Node,
  path: number[],
  index: number,
  text: string,
  color?: StatusColor,
): StatusSplice {
  // Marks can split or join XmlText, so locate the badge among inline elements.
  const badge = block.child(index);
  const atomTypes: string[] = [];
  let atomIndex = 0;
  block.forEach((child, _offset, i) => {
    if (child.isText) return;
    if (i === index) atomIndex = atomTypes.length;
    atomTypes.push(child.type.name);
  });
  return {
    path,
    atomIndex,
    atomTypes,
    standalone: block.childCount === 1,
    oldLabel: badge.attrs.text,
    ...(color !== undefined && { oldColor: badge.attrs.color }),
    patch: {
      ...(text !== badge.attrs.text && { text }),
      ...(color !== undefined && color !== badge.attrs.color && { color }),
    },
    expected: [],
  };
}

export function statusSpliceForReplacement(
  before: Node,
  after: Node,
  path: number[],
): StatusSplice | undefined {
  if (before.childCount !== after.childCount) return;
  const index = before.children.findIndex(
    (node, i) => !node.eq(after.child(i)),
  );
  if (index === -1) return;
  const badge = before.child(index);
  const desired = after.child(index);
  const { text, color } = desired.attrs;
  const colorChanged = color !== badge.attrs.color;
  if (
    badge.type.name !== 'status' ||
    typeof text !== 'string' ||
    /\p{Surrogate}/u.test(text) ||
    (colorChanged && !isStatusColor(color)) ||
    !desired.hasMarkup(
      badge.type,
      { ...badge.attrs, text, color },
      badge.marks,
    ) ||
    !badge.content.eq(desired.content)
  )
    return;
  // Status badges have no IDs. Require every other inline child to stay in place.
  for (let i = index + 1; i < before.childCount; i++) {
    if (!before.child(i).eq(after.child(i))) return;
  }
  return statusSplice(
    before,
    path,
    index,
    text,
    colorChanged ? color : undefined,
  );
}

export function prepareStatusSplice(
  block: Y.XmlFragment,
  { atomIndex, atomTypes, standalone, oldLabel, oldColor, patch }: StatusSplice,
): (() => void) | null {
  if (!block) return null;
  const children = block.toArray();
  const atoms = children.filter((child) => !(child instanceof Y.XmlText));
  const badge = atoms[atomIndex];
  if (
    (standalone &&
      children.some((node) => node instanceof Y.XmlText && node.length)) ||
    atoms.length !== atomTypes.length ||
    !atoms.every(
      (node, i) =>
        node instanceof Y.XmlElement && node.nodeName === atomTypes[i],
    ) ||
    !(badge instanceof Y.XmlElement) ||
    (badge.getAttribute('text') ?? '') !== oldLabel ||
    (oldColor !== undefined &&
      (badge.getAttribute('color') ?? 'gray') !== oldColor)
  )
    return null;
  return () => {
    if (patch.text !== undefined) badge.setAttribute('text', patch.text);
    if (patch.color !== undefined) badge.setAttribute('color', patch.color);
  };
}
