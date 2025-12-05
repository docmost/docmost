import { Box, ActionIcon, Tooltip, Group, Text } from "@mantine/core";
import { IconChevronUp, IconFileDescription } from "@tabler/icons-react";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { Link, useParams } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import classes from "./floating-parent-header.module.css";

interface FloatingParentHeaderProps {
  parentNode: SpaceTreeNode | null;
  isVisible: boolean;
  onCollapse?: (nodeId: string) => void;
}

export default function FloatingParentHeader({
  parentNode,
  isVisible,
  onCollapse,
}: FloatingParentHeaderProps) {
  const { spaceSlug } = useParams();

  if (!parentNode || !isVisible) {
    return null;
  }

  const pageUrl = buildPageUrl(spaceSlug, parentNode.slugId, parentNode.name);

  return (
    <Box className={classes.container}>
      <Group className={classes.content} gap="xs" justify="space-between">
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <div className={classes.icon}>
            {parentNode.icon ? parentNode.icon : <IconFileDescription size="18" />}
          </div>
          <Group gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Link
              to={pageUrl}
              className={classes.link}
              title={parentNode.name}
            >
              <Text 
                size="sm" 
                fw={600} 
                className={classes.text}
              >
                {parentNode.name || "untitled"}
              </Text>
            </Link>
          </Group>
        </Group>

        {onCollapse && (
          <Tooltip label="Collapse" withArrow position="left">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCollapse(parentNode.id);
              }}
              className={classes.collapseButton}
            >
              <IconChevronUp size={18} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Box>
  );
}
