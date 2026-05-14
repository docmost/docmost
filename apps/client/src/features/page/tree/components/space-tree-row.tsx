import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { ActionIcon, rem } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
  IconPlus,
  IconPointFilled,
} from "@tabler/icons-react";

import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { queryClient } from "@/main.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { getPageById } from "@/features/page/services/page-service.ts";
import {
  useUpdatePageMutation,
  fetchAllAncestorChildren,
} from "@/features/page/queries/page-query.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";

import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import type { SpaceTreeNode } from "@/features/page/tree/types.ts";
import type { RenderRowProps } from "./doc-tree";
import { NodeMenu } from "./space-tree-node-menu";
import classes from "@/features/page/tree/styles/tree.module.css";
import { updateTreeNodeIcon } from "@/features/page/tree/utils/utils.ts";

type SpaceTreeRowProps = RenderRowProps<SpaceTreeNode> & {
  readOnly: boolean;
};

export function SpaceTreeRow({
  node,
  isOpen,
  hasChildren,
  toggleOpen,
  rowRef,
  tabIndex,
  treeItemProps,
  readOnly,
}: SpaceTreeRowProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const updatePageMutation = useUpdatePageMutation();
  const [, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  const canEdit = !readOnly && node.canEdit !== false;
  const pageUrl = buildPageUrl(spaceSlug, node.slugId, node.name);

  const prefetchPage = () => {
    timerRef.current = setTimeout(async () => {
      const page = await queryClient.fetchQuery({
        queryKey: ["pages", node.id],
        queryFn: () => getPageById({ pageId: node.id }),
        staleTime: 5 * 60 * 1000,
      });
      if (page?.slugId) {
        queryClient.setQueryData(["pages", page.slugId], page);
      }
    }, 150);
  };

  const cancelPagePrefetch = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleUpdateNodeIcon = (nodeId: string, newIcon: string | null) => {
    setTreeData((prev) =>
      updateTreeNodeIcon(prev, nodeId, newIcon),
    );
  };

  const handleEmojiIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation
      .mutateAsync({ pageId: node.id, icon: emoji.native })
      .then((data) => {
        setTimeout(() => {
          emit({
            operation: "updateOne",
            spaceId: node.spaceId,
            entity: ["pages"],
            id: node.id,
            payload: { icon: emoji.native, parentPageId: data.parentPageId },
          });
        }, 50);
      });
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: null });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: null },
      });
    }, 50);
  };

  const handleLoadChildren = async () => {
    if (!node.hasChildren) return;
    try {
      const childrenTree = await fetchAllAncestorChildren({
        pageId: node.id,
        spaceId: node.spaceId,
      });
      setTreeData((prev) =>
        treeModel.appendChildren(prev, node.id, childrenTree),
      );
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  };

  return (
    <Link
      ref={rowRef as React.Ref<HTMLAnchorElement>}
      to={pageUrl}
      className={classes.node}
      tabIndex={tabIndex}
      {...treeItemProps}
      onClick={() => {
        if (mobileSidebarOpened) {
          toggleMobileSidebar();
        }
      }}
      onMouseEnter={prefetchPage}
      onMouseLeave={cancelPagePrefetch}
    >
      <PageArrow
        isOpen={isOpen}
        hasChildren={hasChildren}
        onToggle={toggleOpen}
      />

      <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          icon={
            node.icon ? node.icon : <IconFileDescription size="18" />
          }
          readOnly={!canEdit}
          removeEmojiAction={handleRemoveEmoji}
          actionIconProps={{ tabIndex: -1 }}
        />
      </div>

      <span className={classes.text}>{node.name || t("untitled")}</span>

      <div className={classes.actions}>
        <NodeMenu node={node} canEdit={canEdit} />

        {canEdit && (
          <CreateNode
            node={node}
            isOpen={isOpen}
            hasChildren={hasChildren}
            onToggle={toggleOpen}
            onExpandTree={handleLoadChildren}
          />
        )}
      </div>
    </Link>
  );
}

interface PageArrowProps {
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

function PageArrow({ isOpen, hasChildren, onToggle }: PageArrowProps) {
  const { t } = useTranslation();

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
        <IconPointFilled size={8} />
      </span>
    );
  }

  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      aria-label={isOpen ? t("Collapse") : t("Expand")}
      aria-expanded={isOpen}
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {isOpen ? (
        <IconChevronDown stroke={2} size={18} />
      ) : (
        <IconChevronRight stroke={2} size={18} />
      )}
    </ActionIcon>
  );
}

interface CreateNodeProps {
  node: SpaceTreeNode;
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onExpandTree: () => Promise<void> | void;
}

function CreateNode({
  node,
  isOpen,
  hasChildren,
  onToggle,
  onExpandTree,
}: CreateNodeProps) {
  const { t } = useTranslation();
  const { handleCreate } = useTreeMutation(node.spaceId);

  async function handleClickCreate() {
    if (node.hasChildren && !hasChildren) {
      // Expand and lazy-load before creating a child. handleCreate reads the
      // latest tree imperatively (via useStore) so we no longer need a
      // setTimeout to wait for React to rerun the closure with fresh data.
      if (!isOpen) onToggle();
      await onExpandTree();
    } else if (!isOpen) {
      onToggle();
    }
    handleCreate(node.id);
  }

  return (
    <ActionIcon
      variant="transparent"
      c="gray"
      aria-label={t("Create page")}
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClickCreate();
      }}
    >
      <IconPlus style={{ width: rem(20), height: rem(20) }} stroke={2} />
    </ActionIcon>
  );
}
