import { ISharedPageTree } from "@/features/share/types/share.types.ts";
import {
  buildSharedPageTree,
  SharedPageTreeNode,
} from "@/features/share/utils.ts";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import clsx from "clsx";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
  IconPointFilled,
} from "@tabler/icons-react";
import { ActionIcon, Box } from "@mantine/core";
import { extractPageSlugId } from "@/lib";
import classes from "@/features/page/tree/styles/tree.module.css";
import styles from "./share.module.css";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import {
  DocTree,
  type DocTreeApi,
  type RenderRowProps,
} from "@/features/page/tree/components/doc-tree";
import { openSharedTreeNodesAtom } from "@/features/share/atoms/open-shared-tree-nodes-atom";

interface SharedTreeProps {
  sharedPageTree: ISharedPageTree;
}

export default function SharedTree({ sharedPageTree }: SharedTreeProps) {
  const { t } = useTranslation();
  const treeRef = useRef<DocTreeApi | null>(null);
  const { pageSlug } = useParams();
  const [openTreeNodes, setOpenTreeNodes] = useAtom(openSharedTreeNodesAtom);

  const currentNodeId = extractPageSlugId(pageSlug);

  const treeData: SharedPageTreeNode[] = useMemo(() => {
    if (!sharedPageTree?.pageTree) return [] as SharedPageTreeNode[];
    return buildSharedPageTree(sharedPageTree.pageTree);
  }, [sharedPageTree?.pageTree]);

  const openIds = useMemo(
    () =>
      new Set(
        Object.keys(openTreeNodes).filter((k) => openTreeNodes[k]),
      ),
    [openTreeNodes],
  );

  useEffect(() => {
    // Auto-open the first level of the shared tree on initial load.
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

  useEffect(() => {
    if (currentNodeId) {
      treeRef.current?.select(currentNodeId, { scrollIntoView: true });
    }
  }, [currentNodeId, treeData]);

  // Stable callbacks so memo(DocTreeRow) actually saves work — see I2 in the
  // post-implementation code review.
  const handleToggle = useCallback(
    (id: string, isOpen: boolean) =>
      setOpenTreeNodes((prev) => ({ ...prev, [id]: isOpen })),
    [setOpenTreeNodes],
  );
  const getDragLabel = useCallback(
    (n: SharedPageTreeNode) => n.name || "untitled",
    [],
  );

  if (!sharedPageTree || !sharedPageTree?.pageTree) {
    return null;
  }

  return (
    <div className={classes.treeContainer}>
      <DocTree<SharedPageTreeNode>
        readOnly
        ref={treeRef}
        data={treeData}
        openIds={openIds}
        selectedId={currentNodeId}
        renderRow={SharedTreeRow}
        onMove={noopMove}
        onToggle={handleToggle}
        getDragLabel={getDragLabel}
        aria-label={t("Pages")}
      />
    </div>
  );
}

// Module-scope noop so it's a stable reference across renders.
const noopMove = () => {};

function SharedTreeRow({
  node,
  isOpen,
  hasChildren,
  isSelected,
  rowRef,
  tabIndex,
  treeItemProps,
  toggleOpen,
}: RenderRowProps<SharedPageTreeNode>) {
  const { shareId } = useParams();
  const { t } = useTranslation();
  const [, setMobileSidebarState] = useAtom(mobileSidebarAtom);

  const pageUrl = buildSharedPageUrl({
    shareId: shareId,
    pageSlugId: node.slugId,
    pageTitle: node.name,
  });

  return (
    <Box
      ref={rowRef as React.Ref<HTMLAnchorElement>}
      tabIndex={tabIndex}
      {...treeItemProps}
      data-selected={isSelected || undefined}
      className={clsx(classes.node, styles.treeNode)}
      component={Link}
      to={pageUrl}
      onClick={() => {
        setMobileSidebarState(false);
      }}
    >
      <SharedPageArrow
        isOpen={isOpen}
        hasChildren={hasChildren}
        onToggle={toggleOpen}
      />
      <div style={{ marginRight: "4px" }}>
        <EmojiPicker
          onEmojiSelect={() => {}}
          icon={
            node.icon ? (
              node.icon
            ) : (
              <IconFileDescription size="18" />
            )
          }
          readOnly={true}
          removeEmojiAction={() => {}}
          actionIconProps={{ tabIndex: -1 }}
        />
      </div>
      <span className={classes.text}>{node.name || t("untitled")}</span>
    </Box>
  );
}

interface SharedPageArrowProps {
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

function SharedPageArrow({
  isOpen,
  hasChildren,
  onToggle,
}: SharedPageArrowProps) {
  if (!hasChildren) {
    return (
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--mantine-color-gray-6)",
          flexShrink: 0,
        }}
      >
        <IconPointFilled size={4} />
      </span>
    );
  }

  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {isOpen ? (
        <IconChevronDown stroke={2} size={16} />
      ) : (
        <IconChevronRight stroke={2} size={16} />
      )}
    </ActionIcon>
  );
}
