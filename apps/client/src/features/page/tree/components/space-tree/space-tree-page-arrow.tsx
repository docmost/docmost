import { NodeApi } from "react-arborist";
import { ActionIcon } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

interface PageArrowProps {
  node: NodeApi<SpaceTreeNode>;
  onExpandTree?: () => void;
}

export function PageArrow({ node, onExpandTree }: PageArrowProps) {
  return (
    <ActionIcon
      size={20}
      variant="subtle"
      c="gray"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        node.toggle();
        onExpandTree();
      }}
    >
      {node.isInternal ? (
        node.children && (node.children.length > 0 || node.data.hasChildren) ? (
          node.isOpen ? (
            <IconChevronDown stroke={2} size={18} />
          ) : (
            <IconChevronRight stroke={2} size={18} />
          )
        ) : null
      ) : null}
    </ActionIcon>
  );
}
