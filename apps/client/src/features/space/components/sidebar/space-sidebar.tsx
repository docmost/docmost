import {
  ActionIcon,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowDown,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFileExport,
  IconHome,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSortAZ,
  IconSortZA,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import {
  useSpaceWatchStatusQuery,
  useWatchSpaceMutation,
  useUnwatchSpaceMutation,
} from "@/features/space/queries/space-watcher-query.ts";
import classes from "./space-sidebar.module.css";
import React from "react";
import { useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { Link, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import { useDisclosure } from "@mantine/hooks";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import SpaceTree from "@/features/page/tree/components/space-tree.tsx";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import PageImportModal from "@/features/page/components/page-import-modal.tsx";
import { useTranslation } from "react-i18next";
import { SwitchSpace } from "./switch-space";
import ExportModal from "@/components/common/export-modal";
import {
  useFavoriteIds,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { searchSpotlight } from "@/features/search/constants";
import { sortPages } from "@/features/page/services/page-service.ts";
import { notifications } from "@mantine/notifications";
import { SpaceTreeNode } from "@/features/page/tree/types";

export function SpaceSidebar() {
  const { t } = useTranslation();
  const [tree] = useAtom(treeApiAtom);
  const location = useLocation();
  const [opened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

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
            marginTop: 2,
            marginBottom: 3,
          }}
        >
          <Group
            gap={4}
            wrap="nowrap"
            justify="space-between"
            style={{ width: "100%" }}
          >
            <SwitchSpace
              spaceName={space?.name}
              spaceSlug={space?.slug}
              spaceIcon={space?.logo}
            />
          </Group>
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
                <span>{t("Overview")}</span>
              </div>
            </UnstyledButton>

            <UnstyledButton
              className={classes.menu}
              onClick={searchSpotlight.open}
            >
              <div className={classes.menuItemInner}>
                <IconSearch
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>{t("Search")}</span>
              </div>
            </UnstyledButton>

            <UnstyledButton className={classes.menu} onClick={openSettings}>
              <div className={classes.menuItemInner}>
                <IconSettings
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>{t("Space settings")}</span>
              </div>
            </UnstyledButton>

            {spaceAbility.can(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Page,
            ) && (
              <UnstyledButton
                className={classes.menu}
                onClick={() => {
                  handleCreatePage();
                  if (mobileSidebarOpened) {
                    toggleMobileSidebar();
                  }
                }}
              >
                <div className={classes.menuItemInner}>
                  <IconPlus
                    size={18}
                    className={classes.menuItemIcon}
                    stroke={2}
                  />
                  <span>{t("New page")}</span>
                </div>
              </UnstyledButton>
            )}
          </div>
        </div>

        <div className={clsx(classes.section, classes.sectionPages)}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              {t("Pages")}
            </Text>

            <Group gap="xs">
              <SpaceMenu
                spaceId={space.id}
                canManagePages={spaceAbility.can(
                  SpaceCaslAction.Manage,
                  SpaceCaslSubject.Page,
                )}
                onSpaceSettings={openSettings}
              />

              {spaceAbility.can(
                SpaceCaslAction.Manage,
                SpaceCaslSubject.Page,
              ) && (
                <Tooltip label={t("Create page")} withArrow position="right">
                  <ActionIcon
                    variant="default"
                    size={18}
                    onClick={handleCreatePage}
                    aria-label={t("Create page")}
                  >
                    <IconPlus />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
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
    </>
  );
}

interface SpaceMenuProps {
  spaceId: string;
  canManagePages: boolean;
  onSpaceSettings: () => void;
}
function SpaceMenu({
  spaceId,
  canManagePages,
  onSpaceSettings,
}: SpaceMenuProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [, setTreeData] = useAtom(treeDataAtom);
  const [importOpened, { open: openImportModal, close: closeImportModal }] =
    useDisclosure(false);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);

  const { data: watchStatus } = useSpaceWatchStatusQuery(spaceId);
  const watchMutation = useWatchSpaceMutation();
  const unwatchMutation = useUnwatchSpaceMutation();
  const isWatching = watchStatus?.watching ?? false;

  const favoriteIds = useFavoriteIds("space");
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();
  const isFavorited = favoriteIds.has(spaceId);

  const handleToggleFavorite = () => {
    const params = { type: "space" as const, spaceId };
    if (isFavorited) {
      removeFavoriteMutation.mutate(params);
    } else {
      addFavoriteMutation.mutate(params);
    }
  };

  const handleToggleWatch = () => {
    if (isWatching) {
      unwatchMutation.mutate(spaceId);
    } else {
      watchMutation.mutate(spaceId);
    }
  };

  const handleSortRootPages = async (direction: 'asc' | 'desc') => {
    try {
      const sorted = await sortPages({ spaceId, parentPageId: null, direction });
      const positionMap = new Map(sorted.map((p) => [p.id, p.position]));
      setTreeData((prev) => {
        const reordered = [...prev].sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          const cmp = nameA.localeCompare(nameB);
          return direction === 'asc' ? cmp : -cmp;
        });
        return reordered.map((node) => ({
          ...node,
          position: positionMap.get(node.id) ?? node.position,
        })) as SpaceTreeNode[];
      });
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || t("Failed to sort pages"),
        color: "red",
      });
    }
  };

  return (
    <>
      <Menu width={200} shadow="md" withArrow>
        <Menu.Target>
          <Tooltip label={t("Space menu")} withArrow position="top">
            <ActionIcon
              variant="default"
              size={18}
              aria-label={t("Space menu")}
            >
              <IconDots />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            onClick={handleToggleFavorite}
            leftSection={
              isFavorited ? (
                <IconStarFilled
                  size={16}
                  color="var(--mantine-color-yellow-filled)"
                />
              ) : (
                <IconStar size={16} />
              )
            }
          >
            {isFavorited ? t("Remove from favorites") : t("Add to favorites")}
          </Menu.Item>

          <Menu.Item
            onClick={handleToggleWatch}
            leftSection={
              isWatching ? <IconEyeOff size={16} /> : <IconEye size={16} />
            }
          >
            {isWatching ? t("Stop watching space") : t("Watch space")}
          </Menu.Item>

          {canManagePages && (
            <>
              <Menu.Divider />

              <Menu.Item
                onClick={() => handleSortRootPages('asc')}
                leftSection={<IconSortAZ size={16} />}
              >
                {t("Sort pages A→Z")}
              </Menu.Item>

              <Menu.Item
                onClick={() => handleSortRootPages('desc')}
                leftSection={<IconSortZA size={16} />}
              >
                {t("Sort pages Z→A")}
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item
                onClick={openImportModal}
                leftSection={<IconArrowDown size={16} />}
              >
                {t("Import pages")}
              </Menu.Item>

              <Menu.Item
                onClick={openExportModal}
                leftSection={<IconFileExport size={16} />}
              >
                {t("Export space")}
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item
                onClick={onSpaceSettings}
                leftSection={<IconSettings size={16} />}
              >
                {t("Space settings")}
              </Menu.Item>

              <Menu.Item
                component={Link}
                to={`/s/${spaceSlug}/trash`}
                leftSection={<IconTrash size={16} />}
              >
                {t("Trash")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      {canManagePages && (
        <>
          <PageImportModal
            spaceId={spaceId}
            open={importOpened}
            onClose={closeImportModal}
          />

          <ExportModal
            type="space"
            id={spaceId}
            open={exportOpened}
            onClose={closeExportModal}
          />
        </>
      )}
    </>
  );
}
