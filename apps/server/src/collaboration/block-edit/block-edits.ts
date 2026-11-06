import { Fragment, Node } from '@tiptap/pm/model';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { tiptapExtensions } from '../collaboration.util';
import { BlockRefIndex, computeBlockRefs } from './block-refs';
import { BlockEdit, BlockEditPlan, BlockSplice } from './block-edits.types';

type BlockRange = { parentPath: number[]; from: number; to: number };

type BlockPosition = { parentPath: number[]; index: number };

type ResolvedEdit = {
  range: BlockRange;
  removes: boolean;
  anchors: number[][];
  position?: BlockPosition;
  nodes: Node[];
  insert: BlockSplice['insert'];
};

type PlannedSplice = { splice: BlockSplice; nodes: Node[]; edits: number[] };

type ChangedParent = { node: Node; edits: number[] };

const lastOf = (path: number[]) => path[path.length - 1];

const nodeAt = (doc: Node, path: number[]) =>
  path.reduce((node, index) => node.child(index), doc);

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

function buildContent(
  doc: Node,
  edit: BlockEdit,
  n: number,
  parentPath: number[],
): Node[] | string {
  if (!edit.content?.length) {
    return edit.type === 'replace'
      ? `Edit ${n}: replace produced no content; use delete to remove blocks.`
      : `Edit ${n}: ${edit.type} produced no content.`;
  }
  try {
    return edit.content.map((json) => {
      const node = doc.type.schema.nodeFromJSON(json);
      node.check();
      return node;
    });
  } catch (error) {
    const parentType = nodeAt(doc, parentPath).type.name;
    return `Edit ${n}: ${parentType} cannot contain that content here (${messageOf(error)}).`;
  }
}

function resolveEdit(
  doc: Node,
  refs: BlockRefIndex,
  edit: BlockEdit,
  n: number,
): ResolvedEdit | string {
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
    return `Edit ${n}: endRef "${edit.endRef}" must be a later sibling of ref "${edit.ref}".`;
  }
  const anchors = [start, end];

  switch (edit.type) {
    case 'delete':
      return { range, removes: true, anchors, nodes: [], insert: [] };
    case 'replace':
    case 'insert_before':
    case 'insert_after': {
      const nodes = buildContent(doc, edit, n, range.parentPath);
      if (typeof nodes === 'string') return nodes;
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
    case 'move_after': {
      if (!edit.targetRef) return `Edit ${n}: ${edit.type} needs a targetRef.`;
      const target = refs.byRef.get(edit.targetRef).path;
      if (isInside(target, range)) {
        return `Edit ${n}: targetRef "${edit.targetRef}" is inside the blocks being moved.`;
      }
      const count = range.to - range.from + 1;
      const paths = Array.from({ length: count }, (_, k) => [
        ...range.parentPath,
        range.from + k,
      ]);
      const offset = edit.type === 'move_after' ? 1 : 0;
      return {
        range,
        removes: true,
        anchors: [...anchors, target],
        position: {
          parentPath: target.slice(0, -1),
          index: lastOf(target) + offset,
        },
        nodes: paths.map((path) => nodeAt(doc, path)),
        insert: paths.map((movedFrom) => ({ movedFrom })),
      };
    }
    default:
      return `Edit ${n}: unknown edit type "${edit.type}".`;
  }
}

function findOverlap(resolved: ResolvedEdit[]): string | undefined {
  for (const [i, edit] of resolved.entries()) {
    if (!edit.removes) continue;
    const j = resolved.findIndex(
      (other, k) =>
        k !== i && other.anchors.some((path) => isInside(path, edit.range)),
    );
    if (j !== -1) {
      return `Edit ${Math.max(i, j) + 1}: it overlaps edit ${Math.min(i, j) + 1}; merge them into one edit.`;
    }
  }
  return undefined;
}

function groupSplices(resolved: ResolvedEdit[]): PlannedSplice[] {
  const planned = new Map<string, PlannedSplice>();
  const at = ({ parentPath, index }: BlockPosition) => {
    const key = [...parentPath, index].join();
    const entry = planned.get(key) ?? {
      splice: { parentPath, index, deleteCount: 0, insert: [] },
      nodes: [],
      edits: [],
    };
    planned.set(key, entry);
    return entry;
  };

  resolved.forEach((edit, i) => {
    if (edit.removes) {
      const { parentPath, from, to } = edit.range;
      const removal = at({ parentPath, index: from });
      removal.splice.deleteCount = to - from + 1;
      removal.edits.push(i);
    }
    if (edit.position) {
      const insertion = at(edit.position);
      insertion.splice.insert.push(...edit.insert);
      insertion.nodes.push(...edit.nodes);
      insertion.edits.push(i);
    }
  });

  return [...planned.values()].sort((a, b) =>
    comparePaths(
      [...b.splice.parentPath, b.splice.index],
      [...a.splice.parentPath, a.splice.index],
    ),
  );
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

const contentError = (node: Node) => {
  try {
    node.type.createChecked(node.attrs, node.content, node.marks);
    return null;
  } catch (error) {
    return messageOf(error);
  }
};

function findSchemaError(newDoc: Node, parents: ChangedParent[]) {
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
    return failures
      .sort((a, b) => a.i - b.i)
      .map(({ line }) => line)
      .join('\n');
  }
}

export function planBlockEdits(doc: Node, edits: BlockEdit[]): BlockEditPlan {
  const refs = computeBlockRefs(doc);
  for (const [i, edit] of edits.entries()) {
    const missing = [
      edit.ref,
      edit.endRef ?? edit.ref,
      edit.targetRef ?? edit.ref,
    ].filter((ref) => !refs.byRef.has(ref));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Edit ${i + 1}: block ref "${missing[0]}" was not found. The page changed since you read it; read it again to get fresh refs.`,
      };
    }
  }

  const resolved: ResolvedEdit[] = [];
  for (const [i, edit] of edits.entries()) {
    const result = resolveEdit(doc, refs, edit, i + 1);
    if (typeof result === 'string') return { ok: false, error: result };
    resolved.push(result);
  }

  const overlap = findOverlap(resolved);
  if (overlap) return { ok: false, error: overlap };

  const planned = groupSplices(resolved);
  const { newDoc, parents } = simulateSplices(doc, planned);
  const error = findSchemaError(newDoc, parents);
  if (error) return { ok: false, error };

  const newRefs = computeBlockRefs(newDoc);
  return {
    ok: true,
    doc: newDoc,
    splices: planned.map(({ splice }) => splice),
    insertedRefs: resolved.map(({ nodes }) =>
      nodes.map((node) => newRefs.byNode.get(node)),
    ),
  };
}

export function applyBlockSplices(
  fragment: Y.XmlFragment,
  splices: BlockSplice[],
): void {
  const parentAt = (path: number[]) =>
    path.reduce<Y.XmlFragment>(
      (parent, index) => parent.get(index) as Y.XmlElement,
      fragment,
    );

  const json = splices.flatMap(({ insert }) =>
    insert.flatMap((item) => ('json' in item ? [item.json] : [])),
  );
  const created =
    json.length > 0
      ? TiptapTransformer.toYdoc(
          { type: 'doc', content: json },
          'default',
          tiptapExtensions,
        ).getXmlFragment('default')
      : null;
  let next = 0;

  // Resolve and clone before mutating: later splices delete moved elements.
  const steps = splices.map((splice) => ({
    splice,
    parent: parentAt(splice.parentPath),
    elements: splice.insert.map((item) =>
      'json' in item
        ? created.get(next++).clone()
        : parentAt(item.movedFrom.slice(0, -1))
            .get(lastOf(item.movedFrom))
            .clone(),
    ),
  }));

  for (const { splice, parent, elements } of steps) {
    if (splice.deleteCount > 0) parent.delete(splice.index, splice.deleteCount);
    if (elements.length > 0) parent.insert(splice.index, elements);
  }
}
