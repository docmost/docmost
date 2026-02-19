import { useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import React, { useCallback, useEffect, useState } from "react";
import { findBreadcrumbPath } from "@/features/page/tree/utils";
import {
  Button,
  Anchor,
  Popover,
  Breadcrumbs,
  ActionIcon,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCornerDownRightDouble, IconDots } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import classes from "./breadcrumb.module.css";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { extractPageSlugId } from "@/lib";
import { useMediaQuery } from "@mantine/hooks";

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
  const { pageSlug, spaceSlug } = useParams();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const isMobile = useMediaQuery("(max-width: 48em)");

  useEffect(() => {
    if (treeData?.length > 0 && currentPage) {
      const breadcrumb = findBreadcrumbPath(treeData, currentPage.id);
      setBreadcrumbNodes(breadcrumb || null);
    }
  }, [currentPage?.id, treeData]);

  const HiddenNodesTooltipContent = () =>
    breadcrumbNodes?.slice(1, -1).map((node) => (
      <Button.Group orientation="vertical" key={node.id}>
        <Button
          justify="start"
          component={Link}
          to={buildPageUrl(spaceSlug, node.slugId, node.name)}
          variant="subtle"
          size="compact-sm"
        >
          <Text fz={"sm"} className={classes.truncatedText}>
            {getTitle(node.name, node.icon)}
          </Text>
        </Button>
      </Button.Group>
    ));

  const MobileHiddenNodesTooltipContent = () =>
    breadcrumbNodes?.map((node, index) => {
      const isCurrent = index === breadcrumbNodes.length - 1;
      return (
        <Button.Group orientation="vertical" key={node.id}>
          {isCurrent ? (
            <Text fz={"sm"} className={classes.currentText} px="sm" py={6}>
              {getTitle(node.name, node.icon)}
            </Text>
          ) : (
            <Button
              justify="start"
              component={Link}
              to={buildPageUrl(spaceSlug, node.slugId, node.name)}
              variant="subtle"
              size="compact-sm"
            >
              <Text fz={"sm"} className={classes.truncatedText}>
                {getTitle(node.name, node.icon)}
              </Text>
            </Button>
          )}
        </Button.Group>
      );
    });

  const renderAnchor = useCallback(
    (node: SpaceTreeNode) => (
      <Tooltip label={node.name} key={node.id}>
        <Anchor
          component={Link}
          to={buildPageUrl(spaceSlug, node.slugId, node.name)}
          underline="never"
          fz="sm"
          key={node.id}
          className={classes.linkText}
        >
          {getTitle(node.name, node.icon)}
        </Anchor>
      </Tooltip>
    ),
    [spaceSlug],
  );

  const renderCurrent = useCallback(
    (node: SpaceTreeNode) => (
      <Tooltip label={node.name} key={node.id}>
        <Text fz="sm" key={node.id} className={classes.currentText}>
          {getTitle(node.name, node.icon)}
        </Text>
      </Tooltip>
    ),
    [],
  );

  const getBreadcrumbItems = () => {
    if (!breadcrumbNodes || breadcrumbNodes.length <= 1) return [];

    if (breadcrumbNodes.length > 3) {
      const firstNode = breadcrumbNodes[0];
      const lastNode = breadcrumbNodes[breadcrumbNodes.length - 1];

      return [
        renderAnchor(firstNode),
        <Popover
          width={250}
          position="bottom"
          withArrow
          shadow="xl"
          key="hidden-nodes"
        >
          <Popover.Target>
            <ActionIcon color="gray" variant="subtle" size={20}>
              <IconDots size={16} stroke={1.75} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <HiddenNodesTooltipContent />
          </Popover.Dropdown>
        </Popover>,
        renderCurrent(lastNode),
      ];
    }

    return breadcrumbNodes.map((node, index) => {
      const isCurrent = index === breadcrumbNodes.length - 1;
      return isCurrent ? renderCurrent(node) : renderAnchor(node);
    });
  };

  const getMobileBreadcrumbItems = () => {
    if (!breadcrumbNodes || breadcrumbNodes.length <= 1) return [];

    if (breadcrumbNodes.length > 0) {
      return [
        <Popover
          width={250}
          position="bottom"
          withArrow
          shadow="xl"
          key="mobile-hidden-nodes"
        >
          <Popover.Target>
            <Tooltip label="Breadcrumbs">
              <ActionIcon color="gray" variant="subtle" size={20}>
                <IconCornerDownRightDouble size={16} stroke={1.75} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <MobileHiddenNodesTooltipContent />
          </Popover.Dropdown>
        </Popover>,
      ];
    }

    return breadcrumbNodes.map((node, index) => {
      const isCurrent = index === breadcrumbNodes.length - 1;
      return isCurrent ? renderCurrent(node) : renderAnchor(node);
    });
  };

  const items = isMobile ? getMobileBreadcrumbItems() : getBreadcrumbItems();

  return (
    <div className={classes.breadcrumbDiv}>
      {items.length > 0 && (
        <Breadcrumbs className={classes.breadcrumbs}>
          {items}
        </Breadcrumbs>
      )}
    </div>
  );
}
