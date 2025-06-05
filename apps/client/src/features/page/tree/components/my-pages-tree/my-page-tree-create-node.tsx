import { NodeApi, TreeApi } from "react-arborist";
import { ActionIcon, rem } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

interface CreateNodeProps {
  node: NodeApi<SpaceTreeNode>;
  treeApi: TreeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

export function CreateNode({ node, treeApi, onExpandTree }: CreateNodeProps) {
  function handleCreate() {
    if (node.data.hasChildren && node.children.length === 0) {
      node.toggle();
      onExpandTree();

      setTimeout(() => {
        treeApi?.create({ type: "internal", parentId: node.id, index: 0 });
      }, 500);
    } else {
      treeApi?.create({ type: "internal", parentId: node.id });
    }
  }

  return (
    <ActionIcon
      variant="transparent"
      c="gray"
      size={18}
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
