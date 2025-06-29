import React from "react";
import {
  ActionIcon,
  Affix,
  AppShell,
  Button,
  Group,
  ScrollArea, Text,
  Tooltip
} from "@mantine/core";
import { useGetSharedPageTreeQuery } from "@/features/share/queries/share-query.ts";
import { Link, useParams } from "react-router-dom";
import SharedTree from "@/features/share/components/shared-tree.tsx";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { ThemeToggle } from "@/components/ui/theme-toggle.tsx";
import { useAtomValue } from "jotai";
import { useAtom } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import { useTranslation } from "react-i18next";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import {
  mobileTableOfContentAsideAtom,
  tableOfContentAsideAtom,
} from "@/features/share/atoms/sidebar-atom.ts";
import { IconList } from "@tabler/icons-react";
import { useToggleToc } from "@/features/share/hooks/use-toggle-toc.ts";
import classes from "./share.module.css";
import {
  SearchControl,
  SearchMobileControl,
} from "@/features/search/components/search-control.tsx";
import { ShareSearchSpotlight } from "@/features/search/share-search-spotlight";
import { shareSearchSpotlight } from "@/features/search/constants";
import { FullWidthToggle } from "@/components/ui/full-width-toggle";

const MemoizedSharedTree = React.memo(SharedTree);

export default function ShareShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);

  const [tocOpened] = useAtom(tableOfContentAsideAtom);
  const [mobileTocOpened] = useAtom(mobileTableOfContentAsideAtom);
  const toggleTocMobile = useToggleToc(mobileTableOfContentAsideAtom);
  const toggleToc = useToggleToc(tableOfContentAsideAtom);

  const { shareId } = useParams();
  const sessionPassword = shareId ? sessionStorage.getItem(`share-password-${shareId}`) : null;
  const { data } = useGetSharedPageTreeQuery(shareId, sessionPassword || undefined);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);

  return (
    <AppShell
      header={{ height: 50 }}
      {...(data?.pageTree?.length > 1 && {
        navbar: {
          width: 300,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: !desktopOpened,
          },
        },
      })}
      aside={{
        width: 300,
        breakpoint: "sm",
        collapsed: {
          mobile: !mobileTocOpened,
          desktop: !tocOpened,
        },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group wrap="nowrap" justify="space-between" py="sm" px="xl">
          <Group wrap="nowrap">
            {data?.pageTree?.length > 1 && (
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
            >
              {import.meta.env.VITE_APP_NAME || "Forkmost"}
            </Text>
          </Group>

          {shareId && (
            <Group visibleFrom="sm">
              <SearchControl onClick={shareSearchSpotlight.open} />
            </Group>
          )}

          <Group>
            <>
              {shareId && (
                <Group hiddenFrom="sm">
                  <SearchMobileControl onSearch={shareSearchSpotlight.open} />
                </Group>
              )}

              <Tooltip label={t("Table of contents")} withArrow>
                <ActionIcon
                  variant="default"
                  style={{ border: "none" }}
                  onClick={toggleTocMobile}
                  hiddenFrom="sm"
                  size="sm"
                >
                  <IconList size={20} stroke={2} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label={t("Table of contents")} withArrow>
                <ActionIcon
                  variant="default"
                  style={{ border: "none" }}
                  onClick={toggleToc}
                  visibleFrom="sm"
                  size="sm"
                >
                  <IconList size={20} stroke={2} />
                </ActionIcon>
              </Tooltip>
            </>

            <FullWidthToggle />
            <ThemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      {data?.pageTree?.length > 1 && (
        <AppShell.Navbar p="md" className={classes.navbar}>
          <MemoizedSharedTree sharedPageTree={data} />
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        {children}
      </AppShell.Main>

      <AppShell.Aside
        p="md"
        withBorder={mobileTocOpened}
        className={classes.aside}
      >
        <ScrollArea style={{ height: "80vh" }} scrollbarSize={5} type="scroll">
          <div style={{ paddingBottom: "50px" }}>
            {readOnlyEditor && (
              <TableOfContents isShare={true} editor={readOnlyEditor} />
            )}
          </div>
        </ScrollArea>
      </AppShell.Aside>

      <ShareSearchSpotlight shareId={shareId} />
    </AppShell>
  );
}
