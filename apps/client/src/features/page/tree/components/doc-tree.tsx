import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import type { TreeNode, DropOp } from '../model/tree-model.types';
import { DocTreeRow } from './doc-tree-row';
import styles from '../styles/tree.module.css';

export type RenderRowProps<T extends object> = {
  node: TreeNode<T>;
  level: number;
  isOpen: boolean;
  hasChildren: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isReceivingDrop: 'before' | 'after' | 'make-child' | null;

  rowRef: Ref<HTMLElement>;
  ariaProps: {
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
  };
  toggleOpen: () => void;
};

export type DocTreeProps<T extends object> = {
  data: TreeNode<T>[];
  openIds: ReadonlySet<string>;
  selectedId?: string;

  renderRow: (props: RenderRowProps<T>) => ReactNode;
  indentPerLevel?: number;
  rowHeight?: number;
  emptyState?: ReactNode;

  onMove: (sourceId: string, op: DropOp) => void | Promise<void>;
  onToggle: (id: string, isOpen: boolean) => void;
  onSelect?: (id: string) => void;

  readOnly?: boolean;
  disableDrag?: (node: TreeNode<T>) => boolean;
  disableDrop?: (node: TreeNode<T>) => boolean;

  getDragLabel: (node: TreeNode<T>) => string;
  uniqueContextId?: symbol;
};

export type DocTreeApi = {
  select: (
    id: string,
    opts?: { scrollIntoView?: boolean; focus?: boolean },
  ) => void;
  scrollTo: (id: string) => void;
  focus: (id: string) => void;
};

type FlatRow<T extends object> = {
  node: TreeNode<T>;
  level: number;
  isLastSibling: boolean;
};

// DFS-walk the tree, emitting only the visible nodes (root nodes always, plus
// the descendants of nodes whose id is in `openIds`). Each emitted row carries
// the precomputed `level` and `isLastSibling` it needs.
function flattenVisible<T extends object>(
  data: TreeNode<T>[],
  openIds: ReadonlySet<string>,
): FlatRow<T>[] {
  const out: FlatRow<T>[] = [];
  const walk = (nodes: TreeNode<T>[], level: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      out.push({ node, level, isLastSibling: i === nodes.length - 1 });
      if (openIds.has(node.id) && node.children?.length) {
        walk(node.children, level + 1);
      }
    }
  };
  walk(data, 0);
  return out;
}

type RowElementMap = Map<string, HTMLElement>;

function DocTreeInner<T extends object>(
  props: DocTreeProps<T>,
  ref: Ref<DocTreeApi>,
) {
  const {
    data,
    openIds,
    selectedId,
    renderRow,
    indentPerLevel = 16,
    rowHeight = 32,
    onMove,
    onToggle,
    onSelect,
    readOnly = false,
    disableDrag,
    disableDrop,
    getDragLabel,
    uniqueContextId,
    emptyState,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef<RowElementMap>(new Map());
  // Set by the keyboard handler when the navigation target hasn't been
  // virtualized yet. Consumed by registerRowElement when the row mounts.
  const pendingFocusIdRef = useRef<string | null>(null);
  // Typeahead state: accumulated buffer, plus the timer that clears it after
  // ~500ms of no typing. Refs only — no re-render needed per keystroke.
  const typeaheadBufferRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextId = useMemo(
    () => uniqueContextId ?? Symbol('doc-tree'),
    [uniqueContextId],
  );

  const registerRowElement = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) {
        rowElementsRef.current.set(id, el);
        if (pendingFocusIdRef.current === id) {
          pendingFocusIdRef.current = null;
          // rAF lets the virtualizer settle layout/transform before focus,
          // so the freshly-scrolled-in row is actually painted in view.
          requestAnimationFrame(() => el.focus());
        }
      } else {
        rowElementsRef.current.delete(id);
      }
    },
    [],
  );

  // Stable live tree accessor — keeps the row useEffect deps stable across
  // tree mutations.
  const rootDataRef = useRef(data);
  rootDataRef.current = data;
  const getRootData = useCallback(() => rootDataRef.current, []);

  // Flat visible list drives virtualization. Re-flattens on data or openIds
  // change — cheap O(N) walk of the loaded tree.
  const flat = useMemo(
    () => flattenVisible(data, openIds),
    [data, openIds],
  );

  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  useImperativeHandle(
    ref,
    (): DocTreeApi => ({
      select: (id, opts) => {
        onSelect?.(id);
        const idx = flat.findIndex((r) => r.node.id === id);
        if (idx >= 0 && opts?.scrollIntoView) {
          virtualizer.scrollToIndex(idx, { align: 'auto' });
        }
        if (opts?.focus) rowElementsRef.current.get(id)?.focus();
      },
      scrollTo: (id) => {
        const idx = flat.findIndex((r) => r.node.id === id);
        if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'auto' });
      },
      focus: (id) => {
        rowElementsRef.current.get(id)?.focus();
      },
    }),
    [onSelect, flat, virtualizer],
  );

  // Auto-scroll the container during drag so users can target rows currently
  // scrolled off-screen. Scoped to drags originating in this DocTree instance
  // via uniqueContextId.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    return autoScrollForElements({
      element: el,
      canScroll: ({ source }) =>
        source.data.uniqueContextId === contextId,
    });
  }, [contextId]);

  // Scroll the selected row into view when it enters the flat list. If the
  // row is already fully visible, leave the user's scroll position alone —
  // only scroll when it's off-screen, and when we do, center it for context.
  // Deep pages may not be in flat at the moment selectedId changes (ancestors
  // still lazy-loading); the effect re-fires once flat contains the row.
  // Guarded by a ref so subsequent flat changes don't fight manual scroll.
  const lastScrolledIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedId) {
      lastScrolledIdRef.current = undefined;
      return;
    }
    if (lastScrolledIdRef.current === selectedId) return;
    const idx = flat.findIndex((r) => r.node.id === selectedId);
    if (idx < 0) return;

    const containerHeight = scrollRef.current?.clientHeight ?? 0;
    const scrollOffset = virtualizer.scrollOffset ?? 0;
    const item = virtualizer
      .getVirtualItems()
      .find((v) => v.index === idx);
    const isFullyVisible =
      !!item &&
      item.start >= scrollOffset &&
      item.start + item.size <= scrollOffset + containerHeight;

    if (!isFullyVisible) {
      virtualizer.scrollToIndex(idx, { align: 'center' });
    }
    lastScrolledIdRef.current = selectedId;
  }, [selectedId, flat, virtualizer]);

  // Keyboard navigation handler — single delegated listener on the <ul role="tree">.
  // The focused row is identified by walking up the DOM to the nearest element
  // carrying data-row-id, so this works whether the user has focused the row
  // itself or one of its inner buttons (chevron, +). No per-row re-renders;
  // focus is moved via .focus() on the registered element, with a pending-id
  // hand-off when the target row is currently virtualized out of view.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      // Ctrl/Alt/Meta are reserved for browser/OS shortcuts; bail out.
      // Shift is allowed through so typeahead can match capital letters.
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const isNavKey =
        !e.shiftKey &&
        (e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'Home' ||
          e.key === 'End');
      // Single printable character → typeahead. e.key.length === 1 excludes
      // multi-char names like "ArrowDown", "Enter", "Tab", etc.
      const isTypeahead = e.key.length === 1 && !isNavKey;
      if (!isNavKey && !isTypeahead) return;

      const target = e.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      const rowEl = target.closest('[data-row-id]');
      if (!rowEl) return;
      const id = rowEl.getAttribute('data-row-id');
      if (!id) return;

      const idx = flat.findIndex((r) => r.node.id === id);
      if (idx < 0) return;

      const focusByIndex = (targetIdx: number) => {
        if (targetIdx < 0 || targetIdx >= flat.length) return;
        const targetId = flat[targetIdx].node.id;
        const existing = rowElementsRef.current.get(targetId);
        if (existing) {
          existing.focus();
        } else {
          pendingFocusIdRef.current = targetId;
          virtualizer.scrollToIndex(targetIdx, { align: 'auto' });
        }
      };

      // Typeahead: accumulate printable chars, jump to next row whose label
      // starts with the buffer. Same-letter presses cycle through matches; a
      // multi-char buffer searches from the current row so the user can
      // refine the prefix. Buffer resets after ~500ms of no typing.
      if (isTypeahead) {
        e.preventDefault();
        const wasEmpty = typeaheadBufferRef.current.length === 0;
        typeaheadBufferRef.current = (
          typeaheadBufferRef.current + e.key
        ).toLowerCase();
        const buffer = typeaheadBufferRef.current;
        if (typeaheadTimerRef.current) {
          clearTimeout(typeaheadTimerRef.current);
        }
        typeaheadTimerRef.current = setTimeout(() => {
          typeaheadBufferRef.current = '';
          typeaheadTimerRef.current = null;
        }, 500);
        // Single-char buffer cycles to the next match (start at idx + 1);
        // multi-char buffer can keep matching the current row.
        const startIdx = wasEmpty ? (idx + 1) % flat.length : idx;
        for (let i = 0; i < flat.length; i++) {
          const probeIdx = (startIdx + i) % flat.length;
          const label = getDragLabel(flat[probeIdx].node).toLowerCase();
          if (label.startsWith(buffer)) {
            focusByIndex(probeIdx);
            break;
          }
        }
        return;
      }

      const row = flat[idx];
      const hasChildren =
        (row.node.children && row.node.children.length > 0) ||
        (row.node as { hasChildren?: boolean }).hasChildren === true;
      const isOpen = openIds.has(row.node.id);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusByIndex(idx + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusByIndex(idx - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (hasChildren && !isOpen) {
            onToggle(row.node.id, true);
          } else if (
            isOpen &&
            row.node.children &&
            row.node.children.length > 0
          ) {
            focusByIndex(idx + 1);
          }
          break;
        case 'ArrowLeft': {
          e.preventDefault();
          if (isOpen && hasChildren) {
            onToggle(row.node.id, false);
          } else {
            // Move to parent — first preceding row with smaller level.
            // Bounded by sibling-count to parent in the flat list; tree depth
            // and sibling counts are small in practice.
            const currentLevel = row.level;
            for (let i = idx - 1; i >= 0; i--) {
              if (flat[i].level < currentLevel) {
                focusByIndex(i);
                break;
              }
            }
          }
          break;
        }
        case 'Home':
          e.preventDefault();
          focusByIndex(0);
          break;
        case 'End':
          e.preventDefault();
          focusByIndex(flat.length - 1);
          break;
      }
    },
    [flat, openIds, onToggle, virtualizer, getDragLabel],
  );

  // Clear the typeahead timer if the component unmounts mid-buffer.
  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  if (data.length === 0 && emptyState) {
    return <div className={styles.treeContainer}>{emptyState}</div>;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className={styles.treeContainer}>
      <ul
        role="tree"
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          height: totalSize,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const row = flat[virtualItem.index];
          return (
            <li
              key={row.node.id}
              role="treeitem"
              aria-level={row.level + 1}
              data-row-id={row.node.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <DocTreeRow
                node={row.node}
                level={row.level}
                isLastSibling={row.isLastSibling}
                openIds={openIds}
                selectedId={selectedId}
                renderRow={renderRow}
                indentPerLevel={indentPerLevel}
                onMove={onMove}
                onToggle={onToggle}
                readOnly={readOnly}
                disableDrag={disableDrag}
                disableDrop={disableDrop}
                getDragLabel={getDragLabel}
                contextId={contextId}
                registerRowElement={registerRowElement}
                getRootData={getRootData}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const DocTree = forwardRef(DocTreeInner) as <T extends object>(
  props: DocTreeProps<T> & { ref?: Ref<DocTreeApi> },
) => ReturnType<typeof DocTreeInner>;
