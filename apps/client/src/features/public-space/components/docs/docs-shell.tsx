import React from "react";
import { ActionIcon, Drawer, Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { IconList, IconMenu2 } from "@tabler/icons-react";
import clsx from "clsx";
import {
  docsMobileSidebarAtom,
  docsMobileTocAtom,
} from "@/features/public-space/atoms/public-space-atoms.ts";
import {
  DocsSurface,
  DocsSurfaceProvider,
} from "@/features/public-space/components/docs/docs-surface-context.tsx";
import DocsSidebarTree from "@/features/public-space/components/docs/docs-sidebar-tree.tsx";
import DocsToc from "@/features/public-space/components/docs/docs-toc.tsx";
import DocsEditPage from "@/features/public-space/components/docs/docs-edit-page.tsx";
import DocsCopyPage from "@/features/public-space/components/docs/docs-copy-page.tsx";
import DocsSearchButton from "@/features/public-space/components/docs/docs-search-button.tsx";
import DocsThemeToggle from "@/features/public-space/components/docs/docs-theme-toggle.tsx";
import DocsFooterBranding from "@/features/public-space/components/docs/docs-footer-branding.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";
import { SearchMobileControl } from "@/features/search/components/search-control.tsx";
import styles from "./docs.module.css";

const MemoizedDocsSidebarTree = React.memo(DocsSidebarTree);

type DocsShellProps = {
  surface: DocsSurface;
  onSearchOpen?: () => void;
  searchSpotlight?: React.ReactNode;
  children: React.ReactNode;
};

export default function DocsShell({
  surface,
  onSearchOpen,
  searchSpotlight,
  children,
}: DocsShellProps) {
  const { t } = useTranslation();
  const { hasSidebar, siteName, homeUrl, showBranding, showEditPage } = surface;

  const [mobileSidebarOpen, setMobileSidebarOpen] = useAtom(
    docsMobileSidebarAtom,
  );
  const [mobileTocOpen, setMobileTocOpen] = useAtom(docsMobileTocAtom);

  return (
    <DocsSurfaceProvider value={surface}>
      <div className={clsx(styles.root, "public-typography")}>
        <SkipToMain />

        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              {hasSidebar && (
                <Tooltip label={t("Toggle sidebar")}>
                  <ActionIcon
                    variant="subtle"
                    className={clsx(styles.headerAction, styles.sidebarToggle)}
                    size="md"
                    onClick={() => setMobileSidebarOpen((value) => !value)}
                    aria-label={t("Toggle sidebar")}
                    aria-expanded={mobileSidebarOpen}
                  >
                    <IconMenu2 size={18} stroke={2} />
                  </ActionIcon>
                </Tooltip>
              )}

              {!hasSidebar && siteName && homeUrl && (
                <Link to={homeUrl} className={styles.headerSpaceName}>
                  {siteName}
                </Link>
              )}
            </div>

            <div className={styles.headerCenter}>
              {onSearchOpen && (
                <div className={styles.searchSlot}>
                  <DocsSearchButton onClick={onSearchOpen} />
                </div>
              )}
            </div>

            <div className={styles.headerRight}>
              {onSearchOpen && (
                <span className={styles.mobileOnly}>
                  <SearchMobileControl onSearch={onSearchOpen} />
                </span>
              )}

              <DocsThemeToggle />
            </div>
          </div>
        </header>

        <div className={styles.body}>
          <nav
            className={styles.sidebar}
            data-hidden={!hasSidebar || undefined}
            aria-label={t("Pages")}
            aria-hidden={!hasSidebar || undefined}
          >
            {hasSidebar && (
              <>
                {siteName && homeUrl && (
                  <>
                    <Link to={homeUrl} className={styles.sidebarTitle}>
                      {siteName}
                    </Link>
                    <div className={styles.sidebarDivider} aria-hidden />
                  </>
                )}
                <div className={styles.sidebarScroll}>
                  <MemoizedDocsSidebarTree />
                </div>
              </>
            )}
          </nav>

          <main className={styles.main} id={MAIN_CONTENT_ID} tabIndex={-1}>
            <div className={styles.article}>
              <div className={styles.articleActions}>
                <DocsCopyPage />
                <span className={styles.tocOverlayControl}>
                  <Tooltip label={t("Table of contents")} withArrow>
                    <ActionIcon
                      variant="subtle"
                      className={styles.headerAction}
                      onClick={() => setMobileTocOpen(true)}
                      size="md"
                      aria-label={t("Table of contents")}
                    >
                      <IconList size={18} stroke={2} />
                    </ActionIcon>
                  </Tooltip>
                </span>
              </div>
              {children}
              {showBranding && (
                <DocsFooterBranding refSource={surface.brandingRef} />
              )}
            </div>
          </main>

          <aside className={styles.toc} aria-label={t("On this page")}>
            <DocsToc />
            {showEditPage && <DocsEditPage />}
          </aside>
        </div>

        <Drawer
          opened={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          title={siteName}
          size={300}
          padding="sm"
        >
          <div className={styles.drawerTree}>
            {hasSidebar && <MemoizedDocsSidebarTree />}
          </div>
        </Drawer>

        <Drawer
          opened={mobileTocOpen}
          onClose={() => setMobileTocOpen(false)}
          position="right"
          size={300}
          padding="md"
        >
          <DocsToc />
          {showEditPage && <DocsEditPage />}
        </Drawer>

        {searchSpotlight}
      </div>
    </DocsSurfaceProvider>
  );
}
