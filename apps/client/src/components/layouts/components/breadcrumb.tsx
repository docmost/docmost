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

function getTitle(name: string, icon: string) {
  if (icon) {
    return `${icon}      ${name}`;
  }
  return name;
}

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
          <Text truncate="end">{getTitle(node.name, node.icon)}</Text>
        </Button>
      </Button.Group>
    ));

  const getLastNthNode = (n: number) =>
    breadcrumbNodes && breadcrumbNodes[breadcrumbNodes.length - n];

  // const getTitle = (title: string) => (title?.length > 0 ? title : "untitled");

  const getBreadcrumbItems = () => {
    if (breadcrumbNodes?.length > 3) {
      return [
        <Anchor
          component={Link}
          to={`/p/${breadcrumbNodes[0].id}`}
          underline="never"
          key={breadcrumbNodes[0].id}
        >
          {getTitle(breadcrumbNodes[0].name, breadcrumbNodes[0].icon)}
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
          {getTitle(getLastNthNode(2)?.name, getLastNthNode(2)?.icon)}
        </Anchor>,
        <Anchor
          component={Link}
          to={`/p/${getLastNthNode(1)?.id}`}
          underline="never"
          key={getLastNthNode(1)?.id}
        >
          {getTitle(getLastNthNode(1)?.name, getLastNthNode(1)?.icon)}
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
          {getTitle(node.name, node.icon)}
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
