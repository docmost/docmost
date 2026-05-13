import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import {
  attachInstruction,
  extractInstruction,
  type Instruction,
  type ItemMode,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { triggerPostMoveFlash } from '@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash';
import * as liveRegion from '@atlaskit/pragmatic-drag-and-drop-live-region';

import type { TreeNode, DropOp } from '../model/tree-model.types';
import { treeModel } from '../model/tree-model';
import { DocTreeDropIndicator } from './doc-tree-drop-indicator';
import { DocTreeDragPreview } from './doc-tree-drag-preview';
import type { RenderRowProps } from './doc-tree';
import styles from '../styles/tree.module.css';

type Props<T extends object> = {
  node: TreeNode<T>;
  level: number;
  isLastSibling: boolean;
  openIds: ReadonlySet<string>;
  selectedId?: string;
  // Roving tabindex: the single row that currently carries tabIndex={0}.
  activeId?: string;
  renderRow: (props: RenderRowProps<T>) => ReactNode;
  indentPerLevel: number;
  onMove: (sourceId: string, op: DropOp) => void | Promise<void>;
  onToggle: (id: string, isOpen: boolean) => void;
  readOnly: boolean;
  disableDrag?: (node: TreeNode<T>) => boolean;
  disableDrop?: (node: TreeNode<T>) => boolean;
  getDragLabel: (node: TreeNode<T>) => string;
  contextId: symbol;
  registerRowElement: (id: string, el: HTMLElement | null) => void;
  // Stable accessor — calling it returns the latest tree. Avoids passing the
  // tree itself as a prop (which would break memo and re-run every row's DnD
  // useEffect on every mutation).
  getRootData: () => TreeNode<T>[];
};

const DRAG_TYPE = 'doc-tree-item';
const AUTO_EXPAND_MS = 500;

function DocTreeRowInner<T extends object>(props: Props<T>) {
  const {
    node,
    level,
    isLastSibling,
    openIds,
    selectedId,
    activeId,
    renderRow,
    indentPerLevel,
    onMove,
    onToggle,
    readOnly,
    disableDrag,
    disableDrop,
    getDragLabel,
    contextId,
    registerRowElement,
    getRootData,
  } = props;

  const isOpen = openIds.has(node.id);
  // "Has children" includes both already-loaded children AND the consumer's
  // own server-side flag (`hasChildren` is a docmost convention on
  // SpaceTreeNode / SharedPageTreeNode). The flag lets the chevron and the
  // auto-expand timer recognize unloaded subtrees so the consumer's lazy-load
  // (via onToggle) can populate them on demand.
  const hasLoadedChildren = !!node.children && node.children.length > 0;
  const declaredHasChildren =
    (node as { hasChildren?: boolean }).hasChildren === true;
  const hasChildren = hasLoadedChildren || declaredHasChildren;
  const isSelected = selectedId === node.id;

  const rowRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAutoExpand = useCallback(() => {
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
  }, []);

  const toggleOpen = useCallback(() => {
    onToggle(node.id, !isOpen);
  }, [onToggle, node.id, isOpen]);

  useEffect(() => {
    registerRowElement(node.id, rowRef.current);
    return () => registerRowElement(node.id, null);
  }, [registerRowElement, node.id]);

  // Restore lazy-loaded children when the row mounts open but its children
  // aren't loaded (e.g. cross-space page move drops a node into a new tree
  // that still has its id in openIds). Calling onToggle(id, true) is
  // idempotent for open state and triggers the consumer's lazy-load.
  useEffect(() => {
    if (isOpen && declaredHasChildren && !hasLoadedChildren) {
      onToggle(node.id, true);
    }
  }, [isOpen, declaredHasChildren, hasLoadedChildren, node.id, onToggle]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || readOnly) return;
    const dragDisabled = disableDrag?.(node) ?? false;
    const dropDisabled = disableDrop?.(node) ?? false;

    const cleanups: Array<() => void> = [];

    if (!dragDisabled) {
      cleanups.push(
        draggable({
          element: el,
          getInitialData: () => ({
            id: node.id,
            type: DRAG_TYPE,
            uniqueContextId: contextId,
            isOpenOnDragStart: isOpen,
          }),
          onGenerateDragPreview: ({ nativeSetDragImage }) => {
            setCustomNativeDragPreview({
              nativeSetDragImage,
              getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }),
              render: ({ container }) => {
                const root = createRoot(container);
                root.render(<DocTreeDragPreview label={getDragLabel(node)} />);
                return () => root.unmount();
              },
            });
          },
          onDragStart: () => setIsDragging(true),
          onDrop: () => setIsDragging(false),
        }),
      );
    }

    if (!dropDisabled) {
      const mode: ItemMode =
        isOpen && hasChildren
          ? 'expanded'
          : isLastSibling
            ? 'last-in-group'
            : 'standard';
      // Always block 'reparent' (out of scope per spec).
      // Block 'reorder-below' when the row is open with children — ambiguous gesture,
      // force users to drop into the folder via 'make-child' instead.
      const block: Instruction['type'][] = ['reparent'];
      if (isOpen && hasChildren) block.push('reorder-below');

      cleanups.push(
        dropTargetForElements({
          element: el,
          canDrop: ({ source }) =>
            source.data.type === DRAG_TYPE &&
            source.data.uniqueContextId === contextId &&
            source.data.id !== node.id &&
            !treeModel.isDescendant(
              getRootData(),
              source.data.id as string,
              node.id,
            ),
          getData: ({ input, element }) =>
            attachInstruction(
              { id: node.id, type: DRAG_TYPE },
              {
                input,
                element,
                currentLevel: level,
                indentPerLevel,
                mode,
                block,
              },
            ),
          onDrag: ({ self }) => {
            const inst = extractInstruction(self.data);
            setInstruction(inst);
            // Auto-expand on hover over any collapsed row that has children,
            // regardless of the specific instruction type. Reorder-before and
            // reorder-after also benefit: once expanded, the user can see the
            // children and refine their drop target.
            if (
              inst &&
              hasChildren &&
              !isOpen &&
              !autoExpandTimerRef.current
            ) {
              autoExpandTimerRef.current = setTimeout(() => {
                onToggle(node.id, true);
                autoExpandTimerRef.current = null;
              }, AUTO_EXPAND_MS);
            }
          },
          onDragLeave: () => {
            setInstruction(null);
            cancelAutoExpand();
          },
          onDrop: ({ source, self }) => {
            setInstruction(null);
            cancelAutoExpand();
            const inst = extractInstruction(self.data);
            if (!inst || inst.type === 'instruction-blocked') return;
            const sourceId = source.data.id as string;
            const op: DropOp =
              inst.type === 'reorder-above'
                ? { kind: 'reorder-before', targetId: node.id }
                : inst.type === 'reorder-below'
                  ? { kind: 'reorder-after', targetId: node.id }
                  : inst.type === 'make-child'
                    ? { kind: 'make-child', targetId: node.id }
                    : null!;
            if (!op) return;
            onMove(sourceId, op);
            triggerPostMoveFlash(el);
            const liveTree = getRootData();
            const parentName =
              op.kind === 'make-child'
                ? getDragLabel(node)
                : (() => {
                    const sib = treeModel.siblingsOf(liveTree, op.targetId);
                    const parent = sib?.parentId
                      ? treeModel.find(liveTree, sib.parentId)
                      : null;
                    return parent ? getDragLabel(parent) : 'root';
                  })();
            const sourceNode = treeModel.find(liveTree, sourceId);
            const sourceLabel = sourceNode
              ? getDragLabel(sourceNode)
              : 'item';
            liveRegion.announce(`Moved ${sourceLabel} under ${parentName}.`);
            // After a make-child drop, expand this row so the user sees the
            // just-dropped child — especially important when the row had no
            // children before (chevron just appeared) so the drop would
            // otherwise be invisible.
            if (op.kind === 'make-child') onToggle(node.id, true);
            if (source.data.isOpenOnDragStart) onToggle(sourceId, true);
          },
        }),
      );
    }

    return combine(...cleanups);
  }, [
    node,
    level,
    isOpen,
    hasChildren,
    isLastSibling,
    readOnly,
    disableDrag,
    disableDrop,
    contextId,
    indentPerLevel,
    getDragLabel,
    onMove,
    onToggle,
    getRootData,
    cancelAutoExpand,
  ]);

  useEffect(() => () => cancelAutoExpand(), [cancelAutoExpand]);

  const effectiveInst =
    instruction?.type === 'instruction-blocked'
      ? instruction.desired
      : instruction;
  const blocked = instruction?.type === 'instruction-blocked';
  const receivingDrop: 'before' | 'after' | 'make-child' | null = (() => {
    if (!effectiveInst) return null;
    if (effectiveInst.type === 'reorder-above') return 'before';
    if (effectiveInst.type === 'reorder-below') return 'after';
    if (effectiveInst.type === 'make-child') return 'make-child';
    return null;
  })();

  // Treeitem semantics ride on the row's focusable element (the consumer's
  // <a>). The outer <li> is presentational layout. aria-label uses the row's
  // label so the SR's accessible name is just the page title, not the
  // concatenation of inner action-button aria-labels.
  const treeItemProps = {
    role: 'treeitem' as const,
    'aria-level': level + 1,
    'aria-expanded': hasChildren ? isOpen : undefined,
    'aria-selected': isSelected ? (true as const) : undefined,
    'aria-current': isSelected ? ('page' as const) : undefined,
    'aria-label': getDragLabel(node),
    'data-row-id': node.id,
  };

  return (
    <div
      className={styles.rowWrapper}
      style={{ paddingLeft: level * indentPerLevel }}
    >
      <div
        className={styles.node}
        data-dragging={isDragging || undefined}
        data-selected={isSelected || undefined}
        data-receiving-drop={
          receivingDrop === 'make-child'
            ? blocked
              ? 'make-child-blocked'
              : 'make-child'
            : undefined
        }
      >
        {renderRow({
          node,
          level,
          isOpen,
          hasChildren,
          isSelected,
          isDragging,
          isReceivingDrop: receivingDrop,
          rowRef,
          tabIndex: activeId === node.id ? 0 : -1,
          treeItemProps,
          toggleOpen,
        })}
      </div>
      {instruction && (
        <DocTreeDropIndicator
          instruction={instruction}
          indentPx={level * indentPerLevel}
        />
      )}
    </div>
  );
}

// Custom memo comparator. The default shallow compare re-renders every row
// when `openIds` (a Set) or `selectedId` (a string) on the parent changes,
// because all rows receive the same reference via {...props} spread. With 1K
// rows that's a perceptible stall on every expand and every navigate.
//
// Resolve openIds / selectedId per-row: only re-render if THIS row's own
// open-state or selected-state actually flipped. Everything else uses
// reference equality (callbacks are useCallback-stable from the parent).
function arePropsEqual<T extends object>(
  prev: Props<T>,
  next: Props<T>,
): boolean {
  if (prev.node !== next.node) return false;
  if (prev.level !== next.level) return false;
  if (prev.isLastSibling !== next.isLastSibling) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.contextId !== next.contextId) return false;
  if (prev.indentPerLevel !== next.indentPerLevel) return false;
  if (prev.renderRow !== next.renderRow) return false;
  if (prev.onMove !== next.onMove) return false;
  if (prev.onToggle !== next.onToggle) return false;
  if (prev.disableDrag !== next.disableDrag) return false;
  if (prev.disableDrop !== next.disableDrop) return false;
  if (prev.getDragLabel !== next.getDragLabel) return false;
  if (prev.registerRowElement !== next.registerRowElement) return false;
  if (prev.getRootData !== next.getRootData) return false;

  const id = next.node.id;
  // openIds: only this row's own membership matters.
  if (prev.openIds.has(id) !== next.openIds.has(id)) return false;
  // selectedId: re-render only the rows whose isSelected actually flipped.
  const wasSelected = prev.selectedId === id;
  const isSelected = next.selectedId === id;
  if (wasSelected !== isSelected) return false;
  // activeId: same trick — only the outgoing and incoming active rows
  // re-render when the user moves focus through the tree.
  const wasActive = prev.activeId === id;
  const isActive = next.activeId === id;
  if (wasActive !== isActive) return false;

  return true;
}

export const DocTreeRow = memo(
  DocTreeRowInner,
  arePropsEqual,
) as typeof DocTreeRowInner;
