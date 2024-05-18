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
import { buildPageSlug } from "@/features/page/page.utils.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";

function getTitle(name: string, icon: string) {
  if (icon) {
    return `${icon} ${name}`;
  }
  return name;
}

export default function Breadcrumb() {
  const treeData = useAtomValue(treeDataAtom);
  const [breadcrumbNodes, setBreadcrumbNodes] = useState<
    SpaceTreeNode[] | null
  >(null);
  const { slugId } = useParams();
  const { data: currentPage } = usePageQuery(slugId);

  useEffect(() => {
    if (treeData?.length > 0 && currentPage) {
      const breadcrumb = findBreadcrumbPath(treeData, currentPage.id);
      if (breadcrumb) {
        setBreadcrumbNodes(breadcrumb);
      }
    }
  }, [currentPage?.id, treeData]);

  const HiddenNodesTooltipContent = () =>
    breadcrumbNodes?.slice(1, -2).map((node) => (
      <Button.Group orientation="vertical" key={node.id}>
        <Button
          justify="start"
          component={Link}
          to={buildPageSlug(node.slugId, node.name)}
          variant="default"
          style={{ border: "none" }}
        >
          <Text truncate="end">{getTitle(node.name, node.icon)}</Text>
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
          to={buildPageSlug(breadcrumbNodes[0].slugId, breadcrumbNodes[0].name)}
          underline="never"
          key={breadcrumbNodes[0].slugId}
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
          to={buildPageSlug(getLastNthNode(2)?.slugId, getLastNthNode(2)?.name)}
          underline="never"
          key={getLastNthNode(2)?.slugId}
        >
          {getTitle(getLastNthNode(2)?.name, getLastNthNode(2)?.icon)}
        </Anchor>,
        <Anchor
          component={Link}
          to={buildPageSlug(getLastNthNode(1)?.slugId, getLastNthNode(1)?.name)}
          underline="never"
          key={getLastNthNode(1)?.slugId}
        >
          {getTitle(getLastNthNode(1)?.name, getLastNthNode(1)?.icon)}
        </Anchor>,
      ];
    }

    if (breadcrumbNodes) {
      return breadcrumbNodes.map((node) => (
        <Anchor
          component={Link}
          to={buildPageSlug(node.slugId, node.name)}
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
