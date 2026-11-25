import { Fragment, Node } from '@tiptap/pm/model';
import { ReplaceStep, Transform } from '@tiptap/pm/transform';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { tiptapExtensions } from '../collaboration.util';
import { validateBlockAttributes } from './block-attributes';
import {
  CellChange,
  editableCellValue,
  resolveCellChanges,
} from './block-cells';
import { documentInsertion } from './block-document';
import {
  changedAttributes,
  changesOnlyTextMarks,
  prepareFormatSplice,
} from './block-format';
import {
  BlockRefIndex,
  computeBlockRefs,
  editableNode,
  pageRevision,
} from './block-refs';
import {
  BlockEdit,
  BlockEditFailure,
  BlockEditPlan,
  BlockEditType,
  BlockSplice,
  EditSplice,
  ExpectedNode,
  FormatSplice,
  MoveDestination,
  UpdatedCell,
} from './block-edits.types';
import {
  prepareStatusSplice,
  statusSpliceForReplacement,
} from './block-status';
import {
  applyTextChange,
  findTextChange,
  indexTextEdits,
  markedTextSplices,
  prepareTextSplice,
  textSpliceForReplacement,
  TextChange,
} from './block-text';

type BlockRange = { parentPath: number[]; from: number; to: number };

type BlockPosition = { parentPath: number[]; index: number };

type ResolvedEdit = {
  range: BlockRange;
  removes: boolean;
  anchors: number[][];
  position?: BlockPosition;
  footnotesAt?: number;
  move?: 'move_before' | 'move_after' | 'move_into';
  nodes: Node[];
  insert: BlockSplice['insert'];
  text?: TextChange;
  cells?: CellChange[];
  attrs?: Record<string, unknown>;
};

type PlannedSplice = {
  splice: BlockSplice;
  nodes: Node[];
  edits: number[];
  removal?: number;
  keepParent?: boolean;
};

type ChangedParent = { node: Node; edits: number[] };

const lastOf = (path: number[]) => path[path.length - 1];

export function isMoveEdit(type: BlockEditType): boolean {
  return type === 'move_before' || type === 'move_after' || type === 'move_into';
}

const nodeAt = (doc: Node, path: number[]) =>
  path.reduce((node, index) => node.child(index), doc);

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function invalidEdit(
  operation: number,
  message: string,
  code = 'invalid_operation',
): BlockEditFailure {
  return { ok: false, code, operation, error: `Edit ${operation}: ${message}` };
}

const isInside = (path: number[], { parentPath, from, to }: BlockRange) =>
  path.length > parentPath.length &&
  parentPath.every((index, depth) => path[depth] === index) &&
  path[parentPath.length] >= from &&
  path[parentPath.length] <= to;

const comparePaths = (a: number[], b: number[]) => {
  for (let depth = 0; depth < Math.min(a.length, b.length); depth++) {
    if (a[depth] !== b[depth]) return a[depth] - b[depth];
  }
  return a.length - b.length;
};

const shapeAlong = (doc: Node, path: number[]): ExpectedNode[] =>
  Array.from({ length: path.length + 1 }, (_, depth) => {
    const prefix = path.slice(0, depth);
    const node = nodeAt(doc, prefix);
    return { path: prefix, type: node.type.name, childCount: node.childCount };
  });

const typeAt = (doc: Node, path: number[]): ExpectedNode => ({
  path,
  type: nodeAt(doc, path).type.name,
});

function expectedShape(doc: Node, splice: BlockSplice): ExpectedNode[] {
  const { parentPath, index, deleteCount } = splice;
  const removed = Array.from({ length: deleteCount }, (_, k) =>
    typeAt(doc, [...parentPath, index + k]),
  );
  const sources = splice.insert.flatMap((item) =>
    'movedFrom' in item
      ? [
          ...shapeAlong(doc, item.movedFrom.slice(0, -1)),
          typeAt(doc, item.movedFrom),
        ]
      : [],
  );
  return [...shapeAlong(doc, parentPath), ...removed, ...sources];
}

export const yNodeAt = (fragment: Y.XmlFragment, path: number[]) => {
  let node = fragment;
  for (const index of path) {
    const child = node.get(index);
    if (!(child instanceof Y.XmlElement)) return null;
    node = child;
  }
  return node;
};

const matchesShape = (
  fragment: Y.XmlFragment,
  { path, type, childCount }: ExpectedNode,
) => {
  const node = yNodeAt(fragment, path);
  if (!node) return false;
  if (node instanceof Y.XmlElement && node.nodeName !== type) return false;
  return childCount === undefined || node.length === childCount;
};

function buildContent(
  doc: Node,
  edit: BlockEdit,
  parentPath: number[],
): Node[] | string {
  if (!edit.content?.length) {
    return edit.type === 'replace'
      ? 'replace produced no content; use delete to remove blocks.'
      : `${edit.type} produced no content.`;
  }
  try {
    return edit.content.map((json) => editableNode(json, doc.type.schema));
  } catch (error) {
    const parentType = nodeAt(doc, parentPath).type.name;
    return `${parentType} cannot contain that content here (${messageOf(error)}).`;
  }
}

function resolveEdit(
  doc: Node,
  refs: BlockRefIndex,
  edit: BlockEdit,
  n: number,
  indexes: ReturnType<typeof indexTextEdits>,
): ResolvedEdit | BlockEditFailure {
  if (isDocumentEdit(edit)) {
    const nodes = buildContent(doc, edit, []);
    if (typeof nodes === 'string') return invalidEdit(n, nodes);
    const location =
      edit.type === 'replace_document'
        ? { index: 0 }
        : documentInsertion(doc, nodes, edit.type === 'prepend_document');
    if (typeof location === 'string') return invalidEdit(n, location);
    return {
      range: { parentPath: [], from: 0, to: doc.childCount - 1 },
      removes: edit.type === 'replace_document',
      anchors: [],
      position: {
        parentPath: [],
        index: location.index,
      },
      footnotesAt: location.footnotesAt,
      nodes,
      insert: edit.content.map((json) => ({ json })),
    };
  }
  const start = refs.byRef.get(edit.ref).path;
  const end = refs.byRef.get(edit.endRef ?? edit.ref).path;
  const range = {
    parentPath: start.slice(0, -1),
    from: lastOf(start),
    to: lastOf(end),
  };
  if (
    end.slice(0, -1).join() !== range.parentPath.join() ||
    range.to < range.from
  ) {
    return invalidEdit(
      n,
      `endRef "${edit.endRef}" must be a later sibling of ref "${edit.ref}".`,
    );
  }
  const anchors = [start, end];

  switch (edit.type) {
    case 'set_attrs': {
      const node = nodeAt(doc, start);
      if (edit.endRef !== undefined || edit.targetRef !== undefined)
        return invalidEdit(n, 'set_attrs takes a single block ref.');
      const attrs = validateBlockAttributes(node.type.name, edit.attrs);
      if (typeof attrs === 'string')
        return invalidEdit(n, attrs, 'invalid_attributes');
      return {
        range,
        removes: false,
        anchors: [start],
        nodes: [],
        insert: [],
        attrs,
      };
    }
    case 'update_cells': {
      if (edit.endRef || edit.targetRef)
        return invalidEdit(n, 'update_cells takes a single table row ref.');
      const cells = resolveCellChanges(nodeAt(doc, start), start, edit.changes);
      if (!Array.isArray(cells)) {
        return {
          ...invalidEdit(n, cells.error, cells.code),
          ...(cells.column !== undefined && { column: cells.column }),
        };
      }
      return {
        range,
        removes: false,
        anchors: cells.map(({ path }) => [...path, 0]),
        nodes: [],
        insert: [],
        cells,
      };
    }
    case 'replace_text': {
      if (edit.endRef || edit.targetRef)
        return invalidEdit(n, 'replace_text takes a single block ref.');
      const text = findTextChange(
        nodeAt(doc, start),
        start,
        edit.oldText,
        edit.newText,
        edit.occurrence,
        indexes.get(edit),
      );
      if (typeof text === 'string') return invalidEdit(n, text);
      return {
        range,
        removes: false,
        anchors: [text.splice.path],
        nodes: [],
        insert: [],
        text,
      };
    }
    case 'delete':
      return { range, removes: true, anchors, nodes: [], insert: [] };
    case 'replace':
    case 'insert_before':
    case 'insert_after': {
      const nodes = buildContent(doc, edit, range.parentPath);
      if (typeof nodes === 'string') return invalidEdit(n, nodes);
      const index = edit.type === 'insert_after' ? range.to + 1 : range.from;
      return {
        range,
        removes: edit.type === 'replace',
        anchors,
        position: { parentPath: range.parentPath, index },
        nodes,
        insert: edit.content.map((json) => ({ json })),
      };
    }
    case 'move_before':
    case 'move_after':
    case 'move_into': {
      if (!edit.targetRef)
        return invalidEdit(n, `${edit.type} needs a targetRef.`);
      const { node: targetNode, path: target } = refs.byRef.get(edit.targetRef);
      if (isInside(target, range)) {
        return invalidEdit(
          n,
          `targetRef "${edit.targetRef}" is inside the blocks being moved.`,
        );
      }
      let position: BlockPosition;
      if (edit.type === 'move_into') {
        if (edit.position !== 'start' && edit.position !== 'end')
          return invalidEdit(n, 'move_into needs position "start" or "end".');
        if (targetNode.isAtom || targetNode.inlineContent)
          return invalidEdit(
            n,
            `${targetNode.type.name} is not a block container. Use a container ref for move_into.`,
          );
        position = {
          parentPath: target,
          index: edit.position === 'start' ? 0 : targetNode.childCount,
        };
      } else {
        position = {
          parentPath: target.slice(0, -1),
          index: lastOf(target) + (edit.type === 'move_after' ? 1 : 0),
        };
      }
      const count = range.to - range.from + 1;
      const paths = Array.from({ length: count }, (_, k) => [
        ...range.parentPath,
        range.from + k,
      ]);
      return {
        range,
        removes: true,
        anchors: [...anchors, target],
        position,
        nodes: paths.map((path) => nodeAt(doc, path)),
        move: edit.type,
        insert: paths.map((movedFrom) => ({ movedFrom })),
      };
    }
    default:
      return invalidEdit(n, `unknown edit type "${edit.type}".`);
  }
}

function findOverlap(resolved: ResolvedEdit[]): BlockEditFailure | undefined {
  for (const [i, edit] of resolved.entries()) {
    const text = edit.text;
    const j = resolved.findIndex(
      (other, k) =>
        k !== i &&
        ((edit.removes &&
          other.anchors.some((path) => isInside(path, edit.range))) ||
          (edit.attrs &&
            other.attrs &&
            comparePaths(edit.anchors[0], other.anchors[0]) === 0 &&
            Object.keys(edit.attrs).some((key) => key in other.attrs)) ||
          (edit.cells &&
            (other.cells || other.text) &&
            edit.anchors.some((path) =>
              other.anchors.some((target) => comparePaths(path, target) === 0),
            )) ||
          (text &&
            other.text &&
            comparePaths(text.splice.path, other.text.splice.path) === 0 &&
            text.splice.run === other.text.splice.run &&
            text.matchFrom < other.text.matchTo &&
            other.text.matchFrom < text.matchTo)),
    );
    if (j !== -1) {
      return invalidEdit(
        Math.max(i, j) + 1,
        `it overlaps edit ${Math.min(i, j) + 1}; merge them into one edit.`,
      );
    }
  }
  return undefined;
}

function requiresMove(edit: ResolvedEdit, resolved: ResolvedEdit[]) {
  const destination = edit.position;
  const inPlace =
    comparePaths(destination.parentPath, edit.range.parentPath) === 0 &&
    (destination.index === edit.range.from ||
      destination.index === edit.range.to + 1);
  return (
    !inPlace ||
    resolved.some(
      (other) =>
        other !== edit &&
        other.position?.index === destination.index &&
        comparePaths(other.position.parentPath, destination.parentPath) === 0,
    )
  );
}

// Ask the editor how deleting a dragged range fits the source tree. A cut
// can remove empty wrappers or supply default content in a required parent.
function dragCut(doc: Node, range: BlockRange) {
  let start = doc.resolve(0);
  for (const index of range.parentPath) {
    start = doc.resolve(start.posAtIndex(index) + 1);
  }
  const [step] = new Transform(doc).deleteRange(
    start.posAtIndex(range.from),
    start.posAtIndex(range.to + 1),
  ).steps;
  if (!(step instanceof ReplaceStep) || step.slice.openStart || step.slice.openEnd) return;
  const from = doc.resolve(step.from);
  const to = doc.resolve(step.to);
  if (!from.sameParent(to) || from.textOffset || to.textOffset) return;
  return {
    range: { parentPath: range.parentPath.slice(0, from.depth), from: from.index(), to: to.index() - 1 },
    fill: step.slice.content,
  };
}

function groupSplices(doc: Node, resolved: ResolvedEdit[]): PlannedSplice[] {
  const planned = new Map<string, PlannedSplice>();
  const at = ({ parentPath, index }: BlockPosition) => {
    const key = [...parentPath, index].join();
    const entry: PlannedSplice = planned.get(key) ?? {
      splice: { parentPath, index, deleteCount: 0, insert: [], expected: [] },
      nodes: [],
      edits: [],
    };
    planned.set(key, entry);
    return entry;
  };

  const moveParents = new Map<string, { path: number[]; edit: number }>();
  resolved.forEach((edit, i) => {
    const { range, position } = edit;
    if (edit.move) {
      if (!requiresMove(edit, resolved)) return;
      const path = edit.range.parentPath;
      moveParents.set(path.join(), { path, edit: i });
    }
    if (edit.removes) {
      const { parentPath, from, to } = range;
      const removal = at({ parentPath, index: from });
      removal.splice.deleteCount = to - from + 1;
      removal.removal = i;
      removal.edits.push(i);
    }
    if (position) {
      const insertion = at(position);
      if (edit.move === 'move_into') insertion.keepParent = true;
      const length =
        edit.footnotesAt === undefined
          ? edit.nodes.length
          : edit.nodes.length - 1;
      insertion.splice.insert.push(...edit.insert.slice(0, length));
      insertion.nodes.push(...edit.nodes.slice(0, length));
      insertion.edits.push(i);
      if (edit.footnotesAt !== undefined) {
        const footer = at({ parentPath: [], index: edit.footnotesAt });
        footer.splice.insert.push(edit.insert[length]);
        footer.nodes.push(edit.nodes[length]);
        footer.edits.push(i);
      }
    }
  });

  for (const { path, edit } of [...moveParents.values()].sort(
    (a, b) => b.path.length - a.path.length,
  )) {
    const local = [...planned.values()].filter(
      ({ splice }) => comparePaths(splice.parentPath, path) === 0,
    );
    if (!local.length || local.some((change) => change.nodes.length)) continue;
    const from = Math.min(...local.map(({ splice }) => splice.index));
    const count = local.reduce((n, { splice }) => n + splice.deleteCount, 0);
    const to = Math.max(
      ...local.map(({ splice }) => splice.index + splice.deleteCount),
    );
    if (to - from !== count || nodeAt(doc, path).canReplace(from, to)) continue;
    const source = { parentPath: path, from, to: to - 1 };
    const cut = dragCut(doc, source);
    if (!cut) continue;

    // Keep an explicitly targeted container. A sibling drop in an emptied wrapper can map to the cut gap.
    for (const { splice, keepParent } of planned.values()) {
      if (
        isInside(splice.parentPath, cut.range) &&
        (keepParent ||
          splice.insert.some(
            (item) => 'json' in item || !isInside(item.movedFrom, source),
          ))
      ) {
        const depth = splice.parentPath.length;
        cut.range = {
          parentPath: path.slice(0, depth),
          from: path[depth],
          to: path[depth],
        };
        cut.fill = Fragment.empty;
      }
    }
    const destination = at({
      parentPath: cut.range.parentPath,
      index: cut.range.from,
    });
    const lifted: PlannedSplice[] = [];
    if (cut.range.parentPath.length < path.length) {
      for (const [key, change] of planned) {
        if (!isInside(change.splice.parentPath, cut.range)) continue;
        planned.delete(key);
        if (change.nodes.length) lifted.push(change);
      }
      destination.splice.deleteCount = cut.range.to - cut.range.from + 1;
      destination.removal = edit;
      destination.edits.push(edit);
    }
    cut.fill.forEach((node) => {
      destination.nodes.push(node);
      destination.splice.insert.push({ json: node.toJSON() });
    });
    for (const change of lifted) {
      destination.nodes.push(...change.nodes);
      destination.splice.insert.push(...change.splice.insert);
      destination.edits.push(...change.edits);
    }
  }
  return [...planned.values()].sort((a, b) =>
    comparePaths(
      [...b.splice.parentPath, b.splice.index],
      [...a.splice.parentPath, a.splice.index],
    ),
  );
}

// Follow the target through the batch and confirm it still directly contains the moved range.
function moveDestination(
  edit: ResolvedEdit,
  planned: PlannedSplice[],
  doc: Node,
  refs: BlockRefIndex,
): MoveDestination | undefined {
  const path = [...edit.position.parentPath];
  for (const { splice } of planned) {
    const { parentPath, index, deleteCount, insert } = splice;
    if (!isInside(path, { parentPath, from: index, to: Infinity })) continue;
    const depth = parentPath.length;
    if (path[depth] < index + deleteCount) return;
    path[depth] += insert.length - deleteCount;
  }
  const parent = nodeAt(doc, path);
  const parentRef = refs.byNode.get(parent);
  const first = parent.children.indexOf(edit.nodes[0]);
  if (
    parentRef &&
    first >= 0 &&
    edit.nodes.every(
      (node, offset) => parent.maybeChild(first + offset) === node,
    )
  ) {
    return { parentRef, parentType: parent.type.name };
  }
}

function updateAt(
  node: Node,
  path: number[],
  update: (node: Node) => Node,
): Node {
  if (path.length === 0) return update(node);
  const [index, ...rest] = path;
  return node.copy(
    node.content.replaceChild(index, updateAt(node.child(index), rest, update)),
  );
}

function simulateSplices(doc: Node, planned: PlannedSplice[]) {
  const parents = new Map<string, ChangedParent>();
  let newDoc = doc;
  for (const { splice, nodes, edits } of planned) {
    newDoc = updateAt(newDoc, splice.parentPath, (parent) => {
      const children: Node[] = [];
      parent.forEach((child) => children.push(child));
      children.splice(splice.index, splice.deleteCount, ...nodes);
      const updated = parent.copy(Fragment.fromArray(children));
      const key = splice.parentPath.join();
      const previous = parents.get(key)?.edits ?? [];
      parents.set(key, { node: updated, edits: [...previous, ...edits] });
      return updated;
    });
  }
  return { newDoc, parents: [...parents.values()] };
}

// Keep unchanged Yjs elements when a replacement includes neighboring or nested blocks.
function replacementSplices(
  doc: Node,
  { splice, nodes }: PlannedSplice,
  replacement: ResolvedEdit,
): EditSplice[] {
  if (!splice.deleteCount || !nodes.length) return [splice];
  const steps: EditSplice[] = [];
  function diff(
    parent: Node,
    path: number[],
    index: number,
    count: number,
    children: readonly Node[],
  ) {
    let start = 0;
    let oldEnd = count;
    let newEnd = children.length;
    while (
      start < oldEnd &&
      start < newEnd &&
      parent.child(index + start).eq(children[start])
    )
      start++;
    while (
      oldEnd > start &&
      newEnd > start &&
      parent.child(index + oldEnd - 1).eq(children[newEnd - 1])
    ) {
      oldEnd--;
      newEnd--;
    }
    const add = (from: number, oldTo: number, newTo: number) => {
      if (oldTo === from && newTo === from) return;
      steps.push({
        parentPath: path,
        index: index + from,
        deleteCount: oldTo - from,
        insert: children
          .slice(from, newTo)
          .map((node) => ({ json: node.toJSON() })),
        expected: [],
      });
    };
    if (oldEnd !== newEnd) {
      add(start, oldEnd, newEnd);
      return;
    }
    // A positional rewrite must not turn a reordered sibling into a different live block.
    if (oldEnd - start > 1) {
      const displaced = new Set<string>();
      const replacements: Node[] = [];
      for (let i = start; i < oldEnd; i++) {
        const previous = parent.child(index + i);
        if (!previous.eq(children[i])) {
          displaced.add(pageRevision(previous));
          replacements.push(children[i]);
        }
      }
      if (replacements.some((child) => displaced.has(pageRevision(child)))) {
        add(start, oldEnd, newEnd);
        return;
      }
    }
    let end = oldEnd;
    for (let i = oldEnd - 1; i >= start; i--) {
      const before = parent.child(index + i);
      const after = children[i];
      const equal = before.eq(after);
      if (
        before.type !== after.type ||
        (before.attrs.id && before.attrs.id !== after.attrs.id)
      )
        continue;
      const childPath = [...path, index + i];
      const changedContent = !equal && !before.content.eq(after.content);
      if (changedContent && before.isAtom) continue;
      let inline: EditSplice[];
      if (changedContent && before.isTextblock) {
        const single = textSpliceForReplacement(
          before,
          before.copy(after.content),
          childPath,
        );
        inline = single
          ? [single]
          : markedTextSplices(before, after, childPath);
        const fill = before.childCount === 0;
        if (!inline) {
          const status = statusSpliceForReplacement(before, after, childPath);
          if (status) inline = [status];
        }
        if (!inline && (fill || changesOnlyTextMarks(before, after))) {
          inline = [
            {
              path: childPath,
              format: after.toJSON(),
              fill,
              expected: [],
            },
          ];
        }
        if (!inline) continue;
      }
      add(i + 1, end, end);
      end = i;
      if (!before.sameMarkup(after))
        steps.push({
          path: childPath,
          attributes: changedAttributes(before.attrs, after.attrs),
          expected: [],
        });
      if (inline) steps.push(...inline);
      else if (changedContent)
        diff(before, childPath, 0, before.childCount, after.content.content);
    }
    add(start, end, end);
  }
  // An insertion beside the preceding sibling can share the replacement's
  // index. Apply it separately so the replacement still edits its live nodes.
  const start = nodes.indexOf(replacement.nodes[0]);
  const end = start + replacement.nodes.length;
  if (end < nodes.length)
    steps.push({
      ...splice,
      index: splice.index + splice.deleteCount,
      deleteCount: 0,
      insert: splice.insert.slice(end),
    });
  diff(
    nodeAt(doc, splice.parentPath),
    splice.parentPath,
    splice.index,
    splice.deleteCount,
    replacement.nodes,
  );
  if (start > 0)
    steps.push({
      ...splice,
      deleteCount: 0,
      insert: splice.insert.slice(0, start),
    });
  return steps;
}

const contentError = (node: Node) => {
  try {
    node.type.createChecked(node.attrs, node.content, node.marks);
    return null;
  } catch (error) {
    return messageOf(error);
  }
};

function findSchemaError(
  newDoc: Node,
  parents: ChangedParent[],
): BlockEditFailure | undefined {
  try {
    newDoc.check();
    return undefined;
  } catch {
    const failures = parents.flatMap(({ node, edits }) => {
      const message = contentError(node);
      if (message === null) return [];
      return [...new Set(edits)].map((i) => ({
        i,
        line: `Edit ${i + 1}: ${node.type.name} cannot contain that content here (${message}).`,
      }));
    });
    // No failing parent means the invalid content predates these edits.
    if (failures.length === 0) return undefined;
    failures.sort((a, b) => a.i - b.i);
    return {
      ok: false,
      code: 'invalid_operation',
      operation: failures[0].i + 1,
      error: failures.map(({ line }) => line).join('\n'),
    };
  }
}

const isDocumentEdit = (edit: BlockEdit) =>
  edit.type === 'replace_document' ||
  edit.type === 'append_document' ||
  edit.type === 'prepend_document';

const uniqueId = tiptapExtensions.find(
  (extension) => extension.name === 'uniqueID',
).options as { types: string[]; attributeName: string };
const typesWithUniqueIds = new Set(uniqueId.types);

function visitPageIds(node: Node, visit: (id: string, type: string) => void) {
  const collect = (child: Node) => {
    if (!typesWithUniqueIds.has(child.type.name)) return;
    const id = child.attrs[uniqueId.attributeName];
    if (id != null && id !== '') visit(String(id), child.type.name);
  };
  collect(node);
  node.descendants(collect);
}

function pageIdCounts(doc: Node, addedIds: Set<string>) {
  const counts = new Map<
    string,
    { total: number; byType: Map<string, number> }
  >();
  visitPageIds(doc, (id, type) => {
    if (!addedIds.has(id)) return;
    const count = counts.get(id) ?? {
      total: 0,
      byType: new Map<string, number>(),
    };
    count.total++;
    count.byType.set(type, (count.byType.get(type) ?? 0) + 1);
    counts.set(id, count);
  });
  return counts;
}

function duplicatePageId(before: Node, after: Node, edits: ResolvedEdit[]) {
  const additions: { id: string; type: string; edit: number }[] = [];
  edits.forEach((change, i) => {
    if (change.move || !change.insert.length) return;
    for (const node of change.nodes) {
      visitPageIds(node, (id, type) =>
        additions.push({ id, type, edit: i + 1 }),
      );
    }
  });
  if (!additions.length) return;
  const ids = new Set(additions.map(({ id }) => id));
  const original = pageIdCounts(before, ids);
  const final = pageIdCounts(after, ids);
  const duplicate = additions.find(({ id, type }) => {
    const previous = original.get(id);
    const next = final.get(id);
    return (
      next.total > Math.max(1, previous?.total ?? 0) ||
      next.byType.get(type) > Math.max(1, previous?.byType.get(type) ?? 0)
    );
  });
  if (!duplicate) return;
  if (duplicate.type === 'transclusionSource') {
    return invalidEdit(
      duplicate.edit,
      'a synced block can only exist once on a page. Edit the existing source by its ref.',
    );
  }
  return invalidEdit(
    duplicate.edit,
    `the ${duplicate.type} ID "${duplicate.id}" is already used on this page.`,
  );
}

function insertedContent(splices: EditSplice[]) {
  return splices.flatMap((step) =>
    'insert' in step
      ? step.insert.flatMap((item) => ('json' in item ? [item.json] : []))
      : [],
  );
}

function recreatesDeletedBlock(
  doc: Node,
  edits: BlockEdit[],
  resolved: ResolvedEdit[],
  splices: EditSplice[],
): boolean {
  if (!edits.some((edit) => edit.type === 'delete')) return false;
  const additions = insertedContent(splices);
  if (!additions.length) return false;
  const inserted = additions.map((json) => doc.type.schema.nodeFromJSON(json));
  const insertedTypes = new Set(inserted.map((node) => node.type));
  const deletedTypes = new Set<Node['type']>();
  const deletedIds = new Set<string>();
  const deletedNodes = new Set<string>();
  edits.forEach((edit, i) => {
    if (edit.type !== 'delete') return;
    const { parentPath, from, to } = resolved[i].range;
    const parent = nodeAt(doc, parentPath);
    for (let k = from; k <= to; k++) {
      const node = parent.child(k);
      deletedTypes.add(node.type);
      deletedNodes.add(pageRevision(node));
      node.descendants((child) => {
        if (insertedTypes.has(child.type))
          deletedNodes.add(pageRevision(child));
      });
      visitPageIds(node, (id) => deletedIds.add(id));
    }
  });
  return inserted.some((node) => {
    if (deletedNodes.has(pageRevision(node))) return true;
    let reused = false;
    node.descendants((child) => {
      if (deletedTypes.has(child.type) && deletedNodes.has(pageRevision(child)))
        reused = true;
      return !reused;
    });
    visitPageIds(node, (id) => {
      if (deletedIds.has(id)) reused = true;
    });
    return reused;
  });
}

export function planBlockEdits(
  doc: Node,
  edits: BlockEdit[],
  expectedRevision?: string,
): BlockEditPlan {
  if (
    expectedRevision !== undefined &&
    expectedRevision !== pageRevision(doc)
  ) {
    return {
      ok: false,
      code: 'stale_revision',
      currentRevision: pageRevision(doc),
      error:
        'The page changed since you read it. Read the page again and retry with the new revision.',
    };
  }
  let refs: BlockRefIndex;
  for (const [i, edit] of edits.entries()) {
    if (isDocumentEdit(edit)) {
      if (edits.length !== 1 || edit.ref || edit.endRef || edit.targetRef) {
        return invalidEdit(
          i + 1,
          'a document edit must be submitted alone without block refs.',
        );
      }
      continue;
    }
    refs ??= computeBlockRefs(doc);
    const missing = [
      edit.ref,
      edit.endRef ?? edit.ref,
      ...(isMoveEdit(edit.type) && edit.targetRef ? [edit.targetRef] : []),
    ].filter((ref) => !refs.byRef.has(ref));
    if (missing.length > 0) {
      return invalidEdit(
        i + 1,
        `block ref "${missing[0]}" was not found in this revision. Read the page again to get its block refs.`,
        'unknown_ref',
      );
    }
  }

  const resolved: ResolvedEdit[] = [];
  const indexes = indexTextEdits(edits, refs);
  for (const [i, edit] of edits.entries()) {
    const result = resolveEdit(doc, refs, edit, i + 1, indexes);
    if ('ok' in result) return result;
    resolved.push(result);
  }

  const overlap = findOverlap(resolved);
  if (overlap) return overlap;
  const planned = groupSplices(doc, resolved);
  const textChanges = resolved
    .flatMap((edit) => edit.text ?? [])
    .sort(
      (a, b) =>
        comparePaths(b.splice.path, a.splice.path) ||
        b.blockOffset + b.matchFrom - a.blockOffset - a.matchFrom,
    );
  let editedDoc = doc;
  const splices: EditSplice[] = [];
  const updatedCells: UpdatedCell[] = [];
  for (const [i, edit] of resolved.entries()) {
    if (edit.attrs) {
      const path = edit.anchors[0];
      const node = nodeAt(editedDoc, path);
      const attrs = { ...node.attrs, ...edit.attrs };
      const attributes = changedAttributes(node.attrs, attrs);
      if (Object.keys(attributes).length) {
        editedDoc = updateAt(editedDoc, path, () =>
          node.type.create(attrs, node.content, node.marks),
        );
        splices.push({ path, attributes, expected: [] });
      }
    }
    for (const { cell, column, path, splice, color } of edit.cells ?? []) {
      if (splice) {
        editedDoc = updateAt(editedDoc, path, () => cell);
        splices.push(splice);
      }
      updatedCells.push({
        rowRef: edits[i].ref,
        column,
        value: editableCellValue(cell),
        ...(color !== undefined && { color }),
      });
    }
  }
  for (const change of textChanges) {
    editedDoc = updateAt(editedDoc, change.splice.path, (node) =>
      applyTextChange(node, change),
    );
    splices.push(change.splice);
  }
  const { newDoc, parents } = simulateSplices(editedDoc, planned);
  const error =
    findSchemaError(newDoc, parents) ?? duplicatePageId(doc, newDoc, resolved);
  if (error) return error;

  for (const change of planned) {
    const removal = resolved[change.removal];
    const explicitRemoval =
      removal?.move || edits[change.removal]?.type === 'delete';
    const steps = explicitRemoval
      ? [change.splice]
      : replacementSplices(doc, change, removal);
    if (
      !explicitRemoval &&
      steps.some((step) => 'deleteCount' in step && step.deleteCount > 0)
    ) {
      return invalidEdit(
        change.removal + 1,
        'this replacement would detach existing collaborative content. Pending edits to those nodes could disappear from the page. No edits in this batch were applied. Use set_attrs for block properties, update_cells for table fields or replace_text for text, keeping the existing nodes in place.',
      );
    }
    splices.push(...steps);
  }
  if (recreatesDeletedBlock(doc, edits, resolved, splices)) {
    return {
      ok: false,
      code: 'invalid_operation',
      error:
        'This batch would detach and recreate a deleted block. Use move_before or move_after to place existing blocks beside a target, or move_into to place them inside a container.',
    };
  }
  for (const splice of splices) {
    // Multiple marked text nodes can share a single Y.XmlText.
    splice.expected =
      'path' in splice
        ? [
            ...shapeAlong(doc, splice.path.slice(0, -1)),
            typeAt(doc, splice.path),
          ]
        : expectedShape(doc, splice);
  }
  const newRefs = resolved.some(({ nodes }) => nodes.length)
    ? computeBlockRefs(newDoc)
    : undefined;
  const movedInto: MoveDestination[] = [];
  for (const [i, edit] of resolved.entries()) {
    if (edit.move !== 'move_into') continue;
    const destination = moveDestination(edit, planned, newDoc, newRefs);
    if (!destination)
      return invalidEdit(
        i + 1,
        'the blocks could not be placed inside the specified container.',
      );
    movedInto.push(destination);
  }
  return {
    ok: true,
    doc: newDoc,
    splices,
    sourceRefs: refs,
    resultRefs: newRefs,
    textTargets: resolved.flatMap(({ text }, edit) =>
      text
        ? [
            {
              edit,
              path: text.splice.path,
              from: text.blockOffset + text.matchFrom,
            },
          ]
        : [],
    ),
    ...(updatedCells.length > 0 && { updatedCells }),
    ...(movedInto.length > 0 && { movedInto }),
    insertedRefs: resolved.map(({ nodes }) =>
      nodes
        .map((node) => newRefs.byNode.get(node))
        .filter((ref) => ref !== undefined),
    ),
  };
}

export function applyBlockSplices(
  fragment: Y.XmlFragment,
  changes: EditSplice[],
  movedElements?: Map<Y.XmlElement, Y.XmlElement>,
): boolean {
  if (
    !changes.every(({ expected }) =>
      expected.every((node) => matchesShape(fragment, node)),
    )
  )
    return false;
  const splices = changes.filter(
    (change): change is BlockSplice => 'parentPath' in change,
  );
  const textSteps = changes.flatMap((change) =>
    'text' in change
      ? [prepareTextSplice(yNodeAt(fragment, change.path), change)]
      : [],
  );
  if (textSteps.some((step) => !step)) return false;
  const statusSteps = changes.flatMap((change) =>
    'atomIndex' in change
      ? [prepareStatusSplice(yNodeAt(fragment, change.path), change)]
      : [],
  );
  if (statusSteps.some((step) => !step)) return false;

  const json = insertedContent(splices);
  const formats = changes.filter(
    (step): step is FormatSplice => 'format' in step,
  );
  const formatStart = json.length;
  json.push(...formats.map((step) => step.format));
  const created =
    json.length > 0
      ? TiptapTransformer.toYdoc(
          { type: 'doc', content: json },
          'default',
          tiptapExtensions,
        ).getXmlFragment('default')
      : null;
  let next = 0;

  const formatSteps = formats.map((step, i) =>
    prepareFormatSplice(
      yNodeAt(fragment, step.path),
      created.get(formatStart + i) as Y.XmlElement,
      step.fill,
    ),
  );
  if (formatSteps.some((step) => !step)) return false;
  const attributes = changes.flatMap((step) =>
    'attributes' in step
      ? [
          {
            element: yNodeAt(fragment, step.path) as Y.XmlElement,
            patch: step.attributes,
          },
        ]
      : [],
  );
  // Prepare every attached target and detached insertion before the first live mutation.
  const steps = splices.map((splice) => ({
    splice,
    parent: yNodeAt(fragment, splice.parentPath),
    elements: splice.insert.map((item) => {
      if ('json' in item) return created.get(next++).clone();
      const source = yNodeAt(fragment, item.movedFrom) as Y.XmlElement;
      const moved = source.clone();
      movedElements?.set(source, moved);
      return moved;
    }),
  }));

  for (const { element, patch } of attributes) {
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) element.removeAttribute(key);
      else element.setAttribute(key, value as any);
    }
  }
  for (const step of formatSteps) step();
  for (const step of statusSteps) step();
  for (const step of textSteps) step();
  for (const { splice, parent, elements } of steps) {
    if (splice.deleteCount > 0) parent.delete(splice.index, splice.deleteCount);
    if (elements.length > 0) parent.insert(splice.index, elements);
  }
  return true;
}
