import { useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import React, { useEffect, useState } from "react";
import { findBreadcrumbPath } from "@/features/page/tree/utils";
import {
  Button,
  Anchor,
  Popover,
  Breadcrumbs,
  ActionIcon,
  Text,
} from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import classes from "./breadcrumb.module.css";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";

export default function Breadcrumb() {
  const treeData = useAtomValue(treeDataAtom);
  const [breadcrumbNodes, setBreadcrumbNodes] = useState<
    SpaceTreeNode[] | null
  >(null);
  const { pageId } = useParams();

  useEffect(() => {
    if (treeData.length) {
      const breadcrumb = findBreadcrumbPath(treeData, pageId);
      if (breadcrumb) {
        setBreadcrumbNodes(breadcrumb);
      }
    }
  }, [pageId, treeData]);

  useEffect(() => {
    if (treeData.length) {
      const breadcrumb = findBreadcrumbPath(treeData, pageId);
      if (breadcrumb) setBreadcrumbNodes(breadcrumb);
    }
  }, [pageId, treeData]);

  const HiddenNodesTooltipContent = () =>
    breadcrumbNodes?.slice(1, -2).map((node) => (
      <Button.Group orientation="vertical" key={node.id}>
        <Button
          justify="start"
          component={Link}
          to={`/p/${node.id}`}
          variant="default"
          style={{ border: "none" }}
        >
          <Text truncate="end">{node.name}</Text>
        </Button>
      </Button.Group>
    ));

  const getLastNthNode = (n: number) =>
    breadcrumbNodes && breadcrumbNodes[breadcrumbNodes.length - n];

  const getBreadcrumbItems = () => {
    if (breadcrumbNodes?.length > 3) {
      return [
        <Anchor
          component={Link}
          to={`/p/${breadcrumbNodes[0].id}`}
          underline="never"
          key={breadcrumbNodes[0].id}
        >
          {breadcrumbNodes[0].name}
        </Anchor>,
        <Popover
          width={250}
          position="bottom"
          withArrow
          shadow="xl"
          key="hidden-nodes"
        >
          <Popover.Target>
            <ActionIcon c="gray" variant="transparent">
              <IconDots size={20} stroke={2} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <HiddenNodesTooltipContent />
          </Popover.Dropdown>
        </Popover>,
        <Anchor
          component={Link}
          to={`/p/${getLastNthNode(2)?.id}`}
          underline="never"
          key={getLastNthNode(2)?.id}
        >
          {getLastNthNode(2)?.name}
        </Anchor>,
        <Anchor
          component={Link}
          to={`/p/${getLastNthNode(1)?.id}`}
          underline="never"
          key={getLastNthNode(1)?.id}
        >
          {getLastNthNode(1)?.name}
        </Anchor>,
      ];
    }

    if (breadcrumbNodes) {
      return breadcrumbNodes.map((node) => (
        <Anchor
          component={Link}
          to={`/p/${node.id}`}
          underline="never"
          key={node.id}
        >
          {node.name}
        </Anchor>
      ));
    }

    return [];
  };

  return (
    <div className={classes.breadcrumb}>
      {breadcrumbNodes ? (
        <Breadcrumbs>{getBreadcrumbItems()}</Breadcrumbs>
      ) : (
        <></>
      )}
    </div>
  );
}
