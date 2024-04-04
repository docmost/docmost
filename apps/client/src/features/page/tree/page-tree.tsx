import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import {
  IconArrowsLeftRight,
  IconChevronDown,
  IconChevronRight,
  IconCornerRightUp,
  IconDotsVertical,
  IconEdit,
  IconFileDescription,
  IconLink,
  IconPlus,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";

import React, { useEffect, useRef } from "react";
import clsx from "clsx";

import classes from "./styles/tree.module.css";
import { ActionIcon, Menu, rem } from "@mantine/core";
import { useAtom } from "jotai";
import { FillFlexParent } from "./components/fill-flex-parent";
import { TreeNode } from "./types";
import { treeApiAtom } from "./atoms/tree-api-atom";
import { usePersistence } from "@/features/page/tree/hooks/use-persistence";
import useWorkspacePageOrder from "@/features/page/tree/hooks/use-workspace-page-order";
import { useNavigate, useParams } from "react-router-dom";
import { convertToTree, updateTreeNodeIcon } from "@/features/page/tree/utils";
import {
  useGetPagesQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";

export default function PageTree() {
  const { data, setData, controllers } = usePersistence<TreeApi<TreeNode>>();
  const [tree, setTree] = useAtom<TreeApi<TreeNode>>(treeApiAtom);
  const { data: pageOrderData } = useWorkspacePageOrder();
  const { data: pagesData, isLoading } = useGetPagesQuery();
  const rootElement = useRef<HTMLDivElement>();
  const { pageId } = useParams();

  const fetchAndSetTreeData = async () => {
    if (pageOrderData?.childrenIds) {
      try {
        if (!isLoading) {
          const treeData = convertToTree(pagesData, pageOrderData.childrenIds);
          setData(treeData);
        }
      } catch (err) {
        console.error("Error fetching tree data: ", err);
      }
    }
  };

  useEffect(() => {
    fetchAndSetTreeData();
  }, [pageOrderData?.childrenIds, isLoading]);

  useEffect(() => {
    setTimeout(() => {
      tree?.select(pageId);
      tree?.scrollTo(pageId, "center");
    }, 200);
  }, [tree, pageId]);

  return (
    <div ref={rootElement} className={classes.treeContainer}>
      <FillFlexParent>
        {(dimens) => (
          <Tree
            data={data}
            {...controllers}
            {...dimens}
            // @ts-ignore
            ref={(t) => setTree(t)}
            openByDefault={false}
            disableMultiSelection={true}
            className={classes.tree}
            rowClassName={classes.row}
            padding={15}
            rowHeight={30}
            overscanCount={5}
            dndRootElement={rootElement.current}
          >
            {Node}
          </Tree>
        )}
      </FillFlexParent>
    </div>
  );
}

function Node({ node, style, dragHandle }: NodeRendererProps<any>) {
  const navigate = useNavigate();
  const updatePageMutation = useUpdatePageMutation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  const handleClick = () => {
    navigate(`/p/${node.id}`);
  };

  const handleUpdateNodeIcon = (nodeId, newIcon) => {
    const updatedTreeData = updateTreeNodeIcon(treeData, nodeId, newIcon);
    setTreeData(updatedTreeData);
  };

  const handleEmojiIconClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEmojiSelect = (emoji) => {
    handleUpdateNodeIcon(node.id, emoji.native);
    updatePageMutation.mutateAsync({ id: node.id, icon: emoji.native });
  };

  const handleRemoveEmoji = () => {
    handleUpdateNodeIcon(node.id, null);
    updatePageMutation.mutateAsync({ id: node.id, icon: null });
  };

  if (node.willReceiveDrop && node.isClosed) {
    setTimeout(() => {
      if (node.state.willReceiveDrop) node.open();
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
        <PageArrow node={node} />

        <div onClick={handleEmojiIconClick} style={{ marginRight: "4px" }}>
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            icon={
              node.data.icon ? (
                node.data.icon
              ) : (
                <IconFileDescription size="18px" />
              )
            }
            removeEmojiAction={handleRemoveEmoji}
          />
        </div>

        <span className={classes.text}>
          {node.isEditing ? (
            <Input node={node} />
          ) : (
            node.data.name || "untitled"
          )}
        </span>

        <div className={classes.actions}>
          <NodeMenu node={node} />
          <CreateNode node={node} />
        </div>
      </div>
    </>
  );
}

function CreateNode({ node }: { node: NodeApi<TreeNode> }) {
  const [tree] = useAtom(treeApiAtom);

  function handleCreate() {
    tree?.create({ type: "internal", parentId: node.id, index: 0 });
  }

  return (
    <ActionIcon
      variant="transparent"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleCreate();
      }}
    >
      <IconPlus style={{ width: rem(20), height: rem(20) }} stroke={2} />
    </ActionIcon>
  );
}

function NodeMenu({ node }: { node: NodeApi<TreeNode> }) {
  const [tree] = useAtom(treeApiAtom);

  function handleDelete() {
    tree?.delete(node);
  }

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon
          variant="transparent"
          c="gray"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <IconDotsVertical
            style={{ width: rem(20), height: rem(20) }}
            stroke={2}
          />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            node.edit();
          }}
        >
          Rename
        </Menu.Item>
        <Menu.Item
          leftSection={<IconStar style={{ width: rem(14), height: rem(14) }} />}
        >
          Favorite
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconLink style={{ width: rem(14), height: rem(14) }} />}
        >
          Copy link
        </Menu.Item>

        <Menu.Item
          leftSection={
            <IconCornerRightUp style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Move
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          leftSection={
            <IconArrowsLeftRight style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Archive
        </Menu.Item>
        <Menu.Item
          c="red"
          leftSection={
            <IconTrash style={{ width: rem(14), height: rem(14) }} />
          }
          onClick={() => handleDelete()}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function PageArrow({ node }: { node: NodeApi<TreeNode> }) {
  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        node.toggle();
      }}
    >
      {node.isInternal ? (
        node.children && node.children.length > 0 ? (
          node.isOpen ? (
            <IconChevronDown stroke={2} size={18} />
          ) : (
            <IconChevronRight stroke={2} size={18} />
          )
        ) : (
          <IconChevronRight size={18} style={{ visibility: "hidden" }} />
        )
      ) : null}
    </ActionIcon>
  );
}

function Input({ node }: { node: NodeApi<TreeNode> }) {
  return (
    <input
      autoFocus
      name="name"
      type="text"
      placeholder="untitled"
      defaultValue={node.data.name}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        if (e.key === "Escape") node.reset();
        if (e.key === "Enter") node.submit(e.currentTarget.value);
      }}
    />
  );
}
