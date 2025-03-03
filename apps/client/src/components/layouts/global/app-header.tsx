import { Badge, Group, Text, Tooltip } from "@mantine/core";
import classes from "./app-header.module.css";
import React from "react";
import TopMenu from "@/components/layouts/global/top-menu.tsx";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useAtom } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import { useTranslation } from "react-i18next";
import useTrial from "@/ee/hooks/use-trial.tsx";
import { isCloud } from "@/lib/config.ts";

const links = [{ link: APP_ROUTE.HOME, label: "Home" }];

export function AppHeader() {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);

  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const { isTrial, trialDaysLeft } = useTrial();

  const isHomeRoute = location.pathname.startsWith("/home");

  const items = links.map((link) => (
    <Link key={link.label} to={link.link} className={classes.link}>
      {t(link.label)}
    </Link>
  ));

  return (
    <>
      <Group h="100%" px="md" justify="space-between" wrap={"nowrap"}>
        <Group wrap="nowrap">
          {!isHomeRoute && (
            <>
              <Tooltip label={t("Sidebar toggle")}>
                <SidebarToggle
                  aria-label={t("Sidebar toggle")}
                  opened={mobileOpened}
                  onClick={toggleMobile}
                  hiddenFrom="sm"
                  size="sm"
                />
              </Tooltip>

              <Tooltip label={t("Sidebar toggle")}>
                <SidebarToggle
                  aria-label={t("Sidebar toggle")}
                  opened={desktopOpened}
                  onClick={toggleDesktop}
                  visibleFrom="sm"
                  size="sm"
                />
              </Tooltip>
            </>
          )}

          <Text
            size="lg"
            fw={600}
            style={{ cursor: "pointer", userSelect: "none" }}
            component={Link}
            to="/home"
          >
            Docmost
          </Text>

          <Group ml={50} gap={5} className={classes.links} visibleFrom="sm">
            {items}
          </Group>
        </Group>

        <Group px={"xl"} wrap="nowrap">
          {isCloud() && isTrial && trialDaysLeft !== 0 && (
            <Badge
              variant="light"
              style={{ cursor: "pointer" }}
              component={Link}
              to={APP_ROUTE.SETTINGS.WORKSPACE.BILLING}
              visibleFrom="xs"
            >
              {trialDaysLeft === 1
                ? "1 day left"
                : `${trialDaysLeft} days left`}
            </Badge>
          )}
          <TopMenu />
        </Group>
      </Group>
    </>
  );
}
