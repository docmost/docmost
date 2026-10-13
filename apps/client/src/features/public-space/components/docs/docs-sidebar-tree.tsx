import { SharedPageTreeNode } from "@/features/share/utils.ts";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { IconChevronRight } from "@tabler/icons-react";
import { ActionIcon } from "@mantine/core";
import { extractPageSlugId } from "@/lib";
import {
  DocTree,
  type DocTreeApi,
  type RenderRowProps,
} from "@/features/page/tree/components/doc-tree";
import {
  docsMobileSidebarAtom,
  openPublicSpaceTreeNodesAtom,
} from "@/features/public-space/atoms/public-space-atoms.ts";
import { useDocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { findAncestorTrail } from "@/features/public-space/utils/docs-tree.ts";
import styles from "./docs.module.css";

export default function DocsSidebarTree() {
  const { t } = useTranslation();
  const treeRef = useRef<DocTreeApi | null>(null);
  const { pageSlug } = useParams();
  const { treeData, getNodeUrl } = useDocsSurface();
  const [openTreeNodes, setOpenTreeNodes] = useAtom(
    openPublicSpaceTreeNodesAtom,
  );

  // The first root page is the surface home, served at the bare URL.
  const firstRootSlugId = treeData?.[0]?.slugId;

  const currentNodeId = pageSlug ? extractPageSlugId(pageSlug) : firstRootSlugId;

  const openIds = useMemo(
    () => new Set(Object.keys(openTreeNodes).filter((k) => openTreeNodes[k])),
    [openTreeNodes],
  );

  useEffect(() => {
    // Auto-open the first level of the tree on initial load.
    const root = treeData?.[0];
    if (!root) return;
    setOpenTreeNodes((prev) => {
      if (prev[root.slugId]) return prev;
      const next = { ...prev, [root.slugId]: true };
      for (const child of root.children ?? []) {
        next[child.slugId] = true;
      }
      return next;
    });
  }, [treeData, setOpenTreeNodes]);

  // Reveal the current page: expand its ancestor trail (deep links land with
  // everything collapsed otherwise) and the page itself when it has children.
  useEffect(() => {
    if (!currentNodeId || !treeData?.length) return;
    const trail = findAncestorTrail(treeData, currentNodeId);
    if (trail === null) return;
    setOpenTreeNodes((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const node of [...trail.map((n) => n.slugId), currentNodeId]) {
        if (!next[node]) {
          next[node] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentNodeId, treeData, setOpenTreeNodes]);

  useEffect(() => {
    if (currentNodeId) {
      treeRef.current?.select(currentNodeId, { scrollIntoView: true });
    }
  }, [currentNodeId, treeData]);

  const handleToggle = useCallback(
    (id: string, isOpen: boolean) =>
      setOpenTreeNodes((prev) => ({ ...prev, [id]: isOpen })),
    [setOpenTreeNodes],
  );
  const getDragLabel = useCallback(
    (n: SharedPageTreeNode) => n.name || "untitled",
    [],
  );

  const renderRow = useCallback(
    (props: RenderRowProps<SharedPageTreeNode>) => (
      <DocsTreeRow {...props} getNodeUrl={getNodeUrl} />
    ),
    [getNodeUrl],
  );

  if (!treeData?.length) {
    return null;
  }

  return (
    <DocTree<SharedPageTreeNode>
      readOnly
      ref={treeRef}
      data={treeData}
      openIds={openIds}
      selectedId={currentNodeId}
      renderRow={renderRow}
      indentPerLevel={INDENT_PER_LEVEL}
      rowHeight={36}
      dynamicRowHeight
      rowClassName={styles.treeNodeChrome}
      onMove={noopMove}
      onToggle={handleToggle}
      getDragLabel={getDragLabel}
      aria-label={t("Pages")}
    />
  );
}

// Module-scope noop so it's a stable reference across renders.
const noopMove = () => {};

const INDENT_PER_LEVEL = 16;


type DocsTreeRowProps = RenderRowProps<SharedPageTreeNode> & {
  getNodeUrl: (node: Pick<SharedPageTreeNode, "slugId" | "name">) => string;
};

function DocsTreeRow({
  node,
  level,
  isOpen,
  hasChildren,
  isSelected,
  rowRef,
  tabIndex,
  treeItemProps,
  toggleOpen,
  getNodeUrl,
}: DocsTreeRowProps) {
  const { t } = useTranslation();
  const setMobileSidebarOpen = useSetAtom(docsMobileSidebarAtom);

  return (
    <Link
      ref={rowRef as React.Ref<HTMLAnchorElement>}
      tabIndex={tabIndex}
      {...treeItemProps}
      data-selected={isSelected || undefined}
      data-open-parent={(level === 0 && isOpen && hasChildren) || undefined}
      className={styles.treeRow}
      to={getNodeUrl(node)}
      onClick={() => {
        setMobileSidebarOpen(false);
      }}
    >
      {/* One segment per ancestor level; contiguous rows join into a rail. */}
      {Array.from({ length: level }, (_, ancestor) => (
        <span
          key={ancestor}
          className={styles.treeGuide}
          style={{ left: -((level - ancestor) * INDENT_PER_LEVEL - 6) }}
          aria-hidden
        />
      ))}
      {node.icon && (
        <span className={styles.treeIcon} aria-hidden>
          {node.icon}
        </span>
      )}
      <span className={styles.treeText}>{node.name || t("untitled")}</span>
      {hasChildren && (
        <ActionIcon
          component="span"
          variant="subtle"
          color="gray"
          size={20}
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleOpen();
          }}
        >
          <IconChevronRight
            className={styles.treeChevron}
            data-open={isOpen || undefined}
            stroke={2}
            size={14}
          />
        </ActionIcon>
      )}
    </Link>
  );
}
