import { TiptapTransformer } from '@hocuspocus/transformer';
import type { Node } from '@tiptap/pm/model';
import * as Y from 'yjs';
import { editableCellValue } from './block-cells';
import {
  applyBlockSplices,
  isMoveEdit,
  planBlockEdits,
  yNodeAt,
} from './block-edits';
import type {
  BlockEdit,
  BlockEditChange,
  BlockEditPlan,
  BlockEditResult,
  MoveDestination,
  UpdatedCell,
} from './block-edits.types';
import {
  type BlockRefIndex,
  computeBlockRefs,
  editableDocument,
  pageRevision,
} from './block-refs';

const TEXT_PREVIEW_LENGTH = 160;

// Match surviving Yjs elements to their saved nodes, indexing each touched parent once.
function savedBlockLookup(fragment: Y.XmlFragment, doc: Node) {
  type Location = { node: Node; parent: Node; index: number };
  const blocks = new Map<Y.XmlFragment, Location>([
    [fragment, { node: doc, parent: doc, index: 0 }],
  ]);
  const indexed = new Set<Y.XmlFragment>();
  function find(element: Y.XmlFragment): Location | undefined {
    if (blocks.has(element)) return blocks.get(element);
    const parent = element?.parent;
    if (!(parent instanceof Y.XmlFragment) || indexed.has(parent)) return;
    const savedParent = find(parent)?.node;
    if (!savedParent) return;
    indexed.add(parent);
    parent.toArray().forEach((child, index) => {
      const node = savedParent.maybeChild(index);
      if (child instanceof Y.XmlElement && node?.type.name === child.nodeName)
        blocks.set(child, { node, parent: savedParent, index });
    });
    return blocks.get(element);
  }
  return find;
}

function captureTargets(
  fragment: Y.XmlFragment,
  refs: BlockRefIndex,
  edits: BlockEdit[],
) {
  const pathOf = (ref: string) => refs.byRef.get(ref).path;
  return edits.map((edit) => {
    if (isMoveEdit(edit.type)) {
      const start = pathOf(edit.ref);
      const end = pathOf(edit.endRef ?? edit.ref);
      const parent = yNodeAt(fragment, start.slice(0, -1));
      const moved = parent?.slice(
        start[start.length - 1],
        end[end.length - 1] + 1,
      );
      return {
        moved: (moved ?? []).filter(
          (child): child is Y.XmlElement => child instanceof Y.XmlElement,
        ),
        target: yNodeAt(fragment, pathOf(edit.targetRef)),
      };
    }
    if (
      edit.type === 'set_attrs' ||
      edit.type === 'replace_text' ||
      edit.type === 'update_cells'
    ) {
      return { block: yNodeAt(fragment, pathOf(edit.ref)) };
    }
    return {};
  });
}

type TextTarget = { edit: number; from: number; element: Y.XmlFragment };

function readSavedText(
  targets: TextTarget[],
  edits: BlockEdit[],
  changes: BlockEditChange[],
  lookup: ReturnType<typeof savedBlockLookup>,
) {
  const shifts = new Map<Y.XmlFragment, number>();
  for (const { edit, element, from } of targets.sort(
    (a, b) => a.from - b.from,
  )) {
    const { oldText, newText } = edits[edit];
    const shift = shifts.get(element) ?? 0;
    shifts.set(element, shift + newText.length - oldText.length);
    const block = lookup(element)?.node;
    const start = from + shift;
    if (!block || start < 0 || start + newText.length > block.content.size)
      continue;
    let length = Math.min(newText.length, TEXT_PREVIEW_LENGTH);
    if (
      length < newText.length &&
      /[\uD800-\uDBFF]/.test(newText.charAt(length - 1))
    )
      length--;
    const text = block.textBetween(start, start + length);
    if (text !== newText.slice(0, length)) continue;
    changes[edit].text = text;
    if (length < newText.length) changes[edit].textTruncated = true;
  }
}

function commitWithReceipt(
  doc: Y.Doc,
  before: Node,
  edits: BlockEdit[],
  plan: Extract<BlockEditPlan, { ok: true }>,
): BlockEditResult {
  const fragment = doc.getXmlFragment('default');
  const targets = captureTargets(fragment, plan.sourceRefs, edits);
  const textTargets = plan.textTargets.map(({ edit, path, from }) => ({
    edit,
    from,
    element: yNodeAt(fragment, path),
  }));
  const movedElements = new Map<Y.XmlElement, Y.XmlElement>();
  if (!applyBlockSplices(fragment, plan.splices, movedElements)) {
    return {
      ok: false,
      code: 'collab_conflict',
      error:
        'This part of the page contains content that cannot be edited safely. Read the page again.',
    };
  }

  const saved = plan.splices.length
    ? editableDocument(TiptapTransformer.fromYdoc(doc, 'default'))
    : before;
  const refs =
    saved === before && plan.sourceRefs
      ? plan.sourceRefs
      : computeBlockRefs(saved);
  const lookup = savedBlockLookup(fragment, saved);
  const updatedCells: UpdatedCell[] = [];
  const movedInto: MoveDestination[] = [];
  const changes = edits.map((edit, i): BlockEditChange => {
    const target = targets[i];
    const change: BlockEditChange = {
      operation: i + 1,
      type: edit.type,
      refs: [],
    };
    if (target.moved) {
      const moved = target.moved.map((source) =>
        lookup(movedElements.get(source) ?? source),
      );
      change.refs = moved.flatMap(
        (block) => refs.byNode.get(block?.node) ?? [],
      );
      const first = moved[0];
      if (first) {
        const parentType = first.parent.type.name;
        const parentRef = refs.byNode.get(first.parent);
        const targetRef = refs.byNode.get(lookup(target.target)?.node);
        change.destination = {
          index: first.index + 1,
          parentType,
          ...(parentRef && { parentRef }),
          ...(targetRef && { targetRef }),
        };
        if (edit.type === 'move_into' && parentRef)
          movedInto.push({ parentRef, parentType });
      }
      return change;
    }
    if (!target.block) {
      change.refs = plan.insertedRefs[i].flatMap((ref) => {
        const expected = plan.resultRefs.byRef.get(ref);
        const actual = expected.path.reduce(
          (node, index) => node?.maybeChild(index),
          saved,
        );
        return actual?.eq(expected.node) ? (refs.byNode.get(actual) ?? []) : [];
      });
      return change;
    }
    const block = lookup(target.block)?.node;
    const ref = refs.byNode.get(block);
    if (!ref) return change;
    change.refs = [ref];
    if (edit.type === 'set_attrs') {
      change.attrs = Object.fromEntries(
        Object.keys(edit.attrs).map((key) => [key, block.attrs[key]]),
      );
    }
    if (edit.type === 'update_cells') {
      for (const { column, color } of edit.changes) {
        const cell = block.child(column - 1);
        updatedCells.push({
          rowRef: ref,
          column,
          value: editableCellValue(cell),
          ...(color !== undefined && {
            color: cell.firstChild.firstChild.attrs.color,
          }),
        });
      }
    }
    return change;
  });
  readSavedText(textTargets, edits, changes, lookup);
  return {
    ok: true,
    contentRevision: pageRevision(saved),
    changes,
    insertedRefs: changes.map((change, i) =>
      targets[i].block ? [] : change.refs,
    ),
    ...(updatedCells.length && { updatedCells }),
    ...(movedInto.length && { movedInto }),
  };
}

export function applyBlockEditsToYDoc(
  doc: Y.Doc,
  edits: BlockEdit[],
  expectedRevision: string,
): BlockEditResult {
  if (!expectedRevision)
    return {
      ok: false,
      code: 'stale_revision',
      error: 'Read the page to get its revision before editing it.',
    };
  return doc.transact(() => {
    let before: Node;
    let plan: BlockEditPlan;
    try {
      before = editableDocument(TiptapTransformer.fromYdoc(doc, 'default'));
      plan = planBlockEdits(before, edits, expectedRevision);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        code: 'collab_conflict',
        error: `The page could not be edited: ${message}`,
      };
    }
    if (plan.ok === false) return plan;
    return commitWithReceipt(doc, before, edits, plan);
  });
}
