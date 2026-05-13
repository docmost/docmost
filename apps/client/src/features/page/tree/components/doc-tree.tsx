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
  const contextId = useMemo(
    () => uniqueContextId ?? Symbol('doc-tree'),
    [uniqueContextId],
  );

  const registerRowElement = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) rowElementsRef.current.set(id, el);
      else rowElementsRef.current.delete(id);
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

  if (data.length === 0 && emptyState) {
    return <div className={styles.treeContainer}>{emptyState}</div>;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className={styles.treeContainer}>
      <ul
        role="tree"
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
