import { useEffect, useState } from "react";
import { ScrollArea, Text, Divider, Modal, UnstyledButton, Tooltip } from "@mantine/core";
import {
  IconHome,
  IconClock,
  IconStar,
  IconLayoutGrid,
  IconSettings,
  IconUserPlus,
  IconTemplate,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import classes from "./global-sidebar.module.css";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { getSpaceUrl } from "@/lib/config";
import { useDisclosure } from "@mantine/hooks";
import { WorkspaceInviteForm } from "@/features/workspace/components/members/components/workspace-invite-form";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";

export default function GlobalSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);
  const hasTemplates = useHasFeature(Feature.TEMPLATES);
  const upgradeLabel = useUpgradeLabel();
  const mainNavItems = [
    { label: "Home", icon: IconHome, path: "/home" },
    { label: "Favorites", icon: IconStar, path: "/favorites" },
    { label: "Spaces", icon: IconLayoutGrid, path: "/spaces" },
    {
      label: "Templates",
      icon: IconTemplate,
      path: "/templates",
      disabled: !hasTemplates,
    },
  ];
  const { data: favoriteSpacesData, isPending: isFavoritesPending } = useFavoritesQuery("space");
  const favoriteSpaces = favoriteSpacesData?.pages.flatMap((p) => p.items) ?? [];
  const sortedFavoriteSpaces = [...favoriteSpaces]
    .filter((fav) => fav.space)
    .sort((a, b) => {
      const cmp = (a.space!.name ?? "").localeCompare(b.space!.name ?? "", undefined, { sensitivity: "base" });
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
  const [inviteOpened, { open: openInvite, close: closeInvite }] =
    useDisclosure(false);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  const handleNavClick = () => {
    if (mobileSidebarOpened) {
      toggleMobileSidebar();
    }
  };

  return (
    <div className={classes.navbar}>
      <ScrollArea w="100%" style={{ flex: 1 }}>
        <div className={classes.section}>
          {mainNavItems.map((item) =>
            item.disabled ? (
              <Tooltip
                key={item.label}
                label={upgradeLabel}
                position="right"
                withArrow
              >
                <UnstyledButton
                  className={classes.link}
                  data-disabled
                  aria-disabled="true"
                  tabIndex={-1}
                >
                  <item.icon className={classes.linkIcon} stroke={2} />
                  <span>{t(item.label)}</span>
                </UnstyledButton>
              </Tooltip>
            ) : (
              <Link
                key={item.label}
                className={classes.link}
                data-active={active === item.path || undefined}
                aria-current={active === item.path ? "page" : undefined}
                to={item.path}
                onClick={handleNavClick}
              >
                <item.icon className={classes.linkIcon} stroke={2} />
                <span>{t(item.label)}</span>
              </Link>
            ),
          )}
        </div>

        <Divider my="xs" />
        <div className={classes.section}>
          <Text component="h2" className={classes.sectionHeader}>{t("Favorite spaces")}</Text>
          {!isFavoritesPending && sortedFavoriteSpaces.length === 0 ? (
            <Text size="xs" c="dimmed" pl="xs" py={4}>
              {t("Favorite spaces appear here")}
            </Text>
          ) : (
            <>
              {sortedFavoriteSpaces.slice(0, 10).map((fav) => (
                <Link
                  key={fav.id}
                  className={classes.spaceItem}
                  to={getSpaceUrl(fav.space!.slug)}
                  onClick={handleNavClick}
                >
                  <CustomAvatar
                    name={fav.space!.name}
                    avatarUrl={fav.space!.logo}
                    type={AvatarIconType.SPACE_ICON}
                    color="initials"
                    variant="filled"
                    size={20}
                  />
                  <Text size="sm" fw={500} lineClamp={1}>
                    {fav.space!.name}
                  </Text>
                </Link>
              ))}
              {sortedFavoriteSpaces.length > 10 && (
                <Link
                  className={classes.spaceItem}
                  to="/spaces"
                  onClick={handleNavClick}
                >
                  <Text size="xs" c="dimmed">
                    {t("View all")}
                  </Text>
                </Link>
              )}
            </>
          )}
        </div>

      </ScrollArea>

      <div className={classes.bottomSection}>
        <UnstyledButton
          className={classes.link}
          onClick={openInvite}
        >
          <IconUserPlus className={classes.linkIcon} stroke={2} />
          <span>{t("Invite People")}</span>
        </UnstyledButton>
        <Link
          className={classes.link}
          data-active={active.startsWith("/settings") || undefined}
          aria-current={active.startsWith("/settings") ? "page" : undefined}
          to="/settings/account/profile"
          onClick={handleNavClick}
        >
          <IconSettings className={classes.linkIcon} stroke={2} />
          <span>{t("Settings")}</span>
        </Link>
      </div>

      <Modal
        size="550"
        opened={inviteOpened}
        onClose={closeInvite}
        title={t("Invite new members")}
        centered
      >
        <Divider size="xs" mb="xs" />
        <ScrollArea h="80%">
          <WorkspaceInviteForm onClose={closeInvite} />
        </ScrollArea>
      </Modal>
    </div>
  );
}
