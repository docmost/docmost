import { NodeApi, NodeRendererProps } from "react-arborist";
import { useAtom } from "jotai";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import classes from "@/features/page/tree/styles/tree.module.css";
import { IconFileDescription, IconLink } from "@tabler/icons-react";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import clsx from "clsx";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import {
  appendNodeChildren,
  buildTree,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils/utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import {
  getPageById,
  getSidebarPages,
} from "@/features/page/services/page-service.ts";
import { SidebarPagesParams } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { PageArrow } from "./space-tree-page-arrow";
import { CreateNode } from "./space-tree-create-node";
import { NodeMenu } from "./space-tree-node-menu";
import { Group } from "@mantine/core";

export function Node({
  node,
  style,
  dragHandle,
  tree,
}: NodeRendererProps<any>) {
  const navigate = useNavigate();
  const updatePageMutation = useUpdatePageMutation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const { spaceSlug } = useParams();
  const timerRef = useRef(null);
  const { t } = useTranslation();

  const prefetchPage = () => {
    timerRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ["pages", node.data.slugId],
        queryFn: () => getPageById({ pageId: node.data.slugId }),
        staleTime: 5 * 60 * 1000,
      });
    }, 150);
  };

  const cancelPagePrefetch = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  async function handleLoadChildren(node: NodeApi<SpaceTreeNode>) {
    if (!node.data.hasChildren) return;
    if (node.data.children && node.data.children.length > 0) {
      return;
    }

    try {
      const params: SidebarPagesParams = {
        pageId: node.data.id,
        spaceId: node.data.spaceId,
      };

      const newChildren = await queryClient.fetchQuery({
        queryKey: ["sidebar-pages", params],
        queryFn: () => getSidebarPages(params),
        staleTime: 10 * 60 * 1000,
      });

      const childrenTree = buildTree(newChildren.items);

      const updatedTreeData = appendNodeChildren(
        treeData,
        node.data.id,
        childrenTree,
      );

      setTreeData(updatedTreeData);
    } catch (error) {
      console.error("Failed to fetch children:", error);
    }
  }

  const handleClick = () => {
    const pageUrl = buildPageUrl(spaceSlug, node.data.slugId, node.data.name);
    navigate(pageUrl);
  };

  const handleUpdateNodeIcon = (nodeId: string, newIcon: string) => {
    const updatedTree = updateTreeNodeIcon(treeData, nodeId, newIcon);
    setTreeData(updatedTree);
  };

  const handleEmojiIconClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: emoji.native });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: emoji.native },
      });
    }, 50);
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ pageId: node.id, icon: null });

    setTimeout(() => {
      emit({
        operation: "updateOne",
        spaceId: node.data.spaceId,
        entity: ["pages"],
        id: node.id,
        payload: { icon: null },
      });
    }, 50);
  };

  if (
    node.willReceiveDrop &&
    node.isClosed &&
    (node.children.length > 0 || node.data.hasChildren)
  ) {
    handleLoadChildren(node);
    setTimeout(() => {
      if (node.state.willReceiveDrop) {
        node.open();
      }
    }, 650);
  }

  return (
    <>
      <div
        style={style}
        className={clsx(classes.node, node.state)}
        ref={dragHandle}
        onClick={handleClick}
        onMouseEnter={prefetchPage}
        onMouseLeave={cancelPagePrefetch}
      >
        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />
        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
            readOnly={tree.props.disableEdit as boolean}
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>
        <span className={classes.text}>{node.data.name || t("untitled")}</span>
        {node.data.isSynced && (
          <div className={classes.syncIndicator} title="Synced">
            <IconLink size={18} />
          </div>
        )}
        <Group gap="xs" className={classes.actions}>
          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}
          <NodeMenu node={node} treeApi={tree} />
        </Group>
      </div>
    </>
  );
}
