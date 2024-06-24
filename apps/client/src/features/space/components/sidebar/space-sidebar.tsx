import {
  ActionIcon,
  Group,
  rem,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import {
  IconHome,
  IconPlus,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";

import classes from "./space-sidebar.module.css";
import React, { useMemo } from "react";
import { useAtom } from "jotai";
import { SearchSpotlight } from "@/features/search/search-spotlight.tsx";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import { Link, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import { useDisclosure } from "@mantine/hooks";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { SpaceName } from "@/features/space/components/sidebar/space-name.tsx";
import { getSpaceUrl } from "@/lib/config.ts";
import SpaceTree from "@/features/page/tree/components/space-tree.tsx";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

export function SpaceSidebar() {
  const [tree] = useAtom(treeApiAtom);
  const location = useLocation();
  const [opened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const { spaceSlug } = useParams();
  const { data: space, isLoading, isError } = useGetSpaceBySlugQuery(spaceSlug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useMemo(() => useSpaceAbility(spaceRules), [spaceRules]);

  if (!space) {
    return <></>;
  }

  function handleCreatePage() {
    tree?.create({ parentId: null, type: "internal", index: 0 });
  }

  return (
    <>
      <div className={classes.navbar}>
        <div
          className={classes.section}
          style={{
            border: "none",
            marginBottom: "0",
          }}
        >
          <SpaceName spaceName={space?.name} />
        </div>

        <div className={classes.section}>
          <div className={classes.menuItems}>
            <UnstyledButton
              component={Link}
              to={getSpaceUrl(spaceSlug)}
              className={clsx(
                classes.menu,
                location.pathname.toLowerCase() === getSpaceUrl(spaceSlug)
                  ? classes.activeButton
                  : "",
              )}
            >
              <div className={classes.menuItemInner}>
                <IconHome
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>Overview</span>
              </div>
            </UnstyledButton>

            <UnstyledButton className={classes.menu} onClick={spotlight.open}>
              <div className={classes.menuItemInner}>
                <IconSearch
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>Search</span>
              </div>
            </UnstyledButton>

            <UnstyledButton className={classes.menu} onClick={openSettings}>
              <div className={classes.menuItemInner}>
                <IconSettings
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>Space settings</span>
              </div>
            </UnstyledButton>

            {spaceAbility.can(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Page,
            ) && (
              <UnstyledButton
                className={classes.menu}
                onClick={handleCreatePage}
              >
                <div className={classes.menuItemInner}>
                  <IconPlus
                    size={18}
                    className={classes.menuItemIcon}
                    stroke={2}
                  />
                  <span>New page</span>
                </div>
              </UnstyledButton>
            )}
          </div>
        </div>

        <div className={classes.section}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              Pages
            </Text>

            {spaceAbility.can(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Page,
            ) && (
              <Tooltip label="Create page" withArrow position="right">
                <ActionIcon
                  variant="default"
                  size={18}
                  onClick={handleCreatePage}
                >
                  <IconPlus
                    style={{ width: rem(12), height: rem(12) }}
                    stroke={1.5}
                  />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          <div className={classes.pages}>
            <SpaceTree
              spaceId={space.id}
              readOnly={spaceAbility.cannot(
                SpaceCaslAction.Manage,
                SpaceCaslSubject.Page,
              )}
            />
          </div>
        </div>
      </div>

      <SpaceSettingsModal
        opened={opened}
        onClose={closeSettings}
        spaceId={space?.slug}
      />

      <SearchSpotlight spaceId={space.id} />
    </>
  );
}
