import { NodeApi, NodeRendererProps } from "react-arborist";
import { useNavigate, useParams } from "react-router-dom";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { SidebarPagesParams } from "@/features/page/types/page.types.ts";
import { queryClient } from "@/main.tsx";
import { getSidebarPages } from "@/features/page/services/page-service.ts";
import {
  appendNodeChildren,
  buildTree,
  updateTreeNodeIcon,
} from "@/features/page/tree/utils";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import clsx from "clsx";
import classes from "@/features/page/tree/styles/tree.module.css";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { IconFileDescription } from "@tabler/icons-react";
import React from "react";
import { CreateNode } from "@/features/page/tree/components/node/components/create-node.tsx";
import { NodeMenu } from "@/features/page/tree/components/node/components/node-menu.tsx";
import { PageArrow } from "@/features/page/tree/components/node/components/page-arrow.tsx";

export function Node({
  node,
  style,
  dragHandle,
  tree,
}: NodeRendererProps<SpaceTreeNode>) {
  const navigate = useNavigate();
  const updatePageMutation = useUpdatePageMutation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const { spaceSlug } = useParams();

  async function handleLoadChildren({ data }: NodeApi<SpaceTreeNode>) {
    if (!data.hasChildren) return;

    if (data.children && data.children.length > 0) {
      return;
    }

    try {
      const params: SidebarPagesParams = {
        pageId: data.id,
        spaceId: data.spaceId,
      };

      const newChildren = await queryClient.fetchQuery({
        queryKey: ["sidebar-pages", params],
        queryFn: () => getSidebarPages(params),
        staleTime: 10 * 60 * 1000,
      });

      const childrenTree = buildTree(newChildren.items);

      const updatedTreeData = appendNodeChildren(
        treeData,
        data.id,
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

  const handleEmojiIconClick = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function updateEmoji(emojiValue: string | null) {
    const updatedTree = updateTreeNodeIcon(treeData, node.id, emojiValue);

    setTreeData(updatedTree);

    updatePageMutation.mutateAsync({ pageId: node.id, icon: emojiValue });

    setTimeout(() => {
      emit({
        entity: ["pages"],
        operation: "updateOne",
        payload: { icon: emojiValue },
        id: node.id,
      });
    }, 50);
  }

  const handleEmojiSelect = (emoji: { native: string }) => {
    updateEmoji(emoji.native);
  };

  const handleRemoveEmoji = () => {
    updateEmoji(null);
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
      >
        <PageArrow node={node} onExpandTree={() => handleLoadChildren(node)} />

        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            readOnly={tree.props.disableEdit as boolean}
            removeEmojiAction={handleRemoveEmoji}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18" />
              )
            }
          />
        </div>

        <span className={classes.text}>{node.data.name || "untitled"}</span>

        <div className={classes.actions}>
          <NodeMenu node={node} treeApi={tree} />

          {!tree.props.disableEdit && (
            <CreateNode
              node={node}
              treeApi={tree}
              onExpandTree={() => handleLoadChildren(node)}
            />
          )}
        </div>
      </div>
    </>
  );
}
