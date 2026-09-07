import { Menu } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Fragment, useMemo, type ReactNode } from "react";
import { useDocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { findAncestorTrail } from "@/features/public-space/utils/docs-tree.ts";
import { extractPageSlugId } from "@/lib";
import styles from "./docs.module.css";

type Crumb = {
  key: string;
  name: string;
  url: string;
};

export default function DocsBreadcrumbs() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { treeData, siteName, homeUrl, getNodeUrl } = useDocsSurface();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const crumbs = useMemo<Crumb[] | null>(() => {
    if (!treeData?.length) return null;

    const currentSlugId = pageSlug
      ? extractPageSlugId(pageSlug)
      : treeData[0]?.slugId;
    if (!currentSlugId) return null;

    const trail = findAncestorTrail(treeData, currentSlugId);
    if (trail === null) return null;

    const siteCrumbs: Crumb[] =
      siteName && homeUrl
        ? [{ key: "site", name: siteName, url: homeUrl }]
        : [];

    const list = [
      ...siteCrumbs,
      ...trail.map((node) => ({
        key: node.slugId,
        name: node.name || t("untitled"),
        url: getNodeUrl(node),
      })),
    ];
    return list.length ? list : null;
  }, [treeData, siteName, homeUrl, getNodeUrl, pageSlug, t]);

  if (!crumbs) return null;

  // Mobile keeps a single line (menu + last crumb, like the app header's
  // breadcrumb); desktop collapses the middle beyond 4 crumbs.
  const collapsed = crumbs.length > (isMobile ? 1 : 4);
  const hidden = !collapsed
    ? []
    : isMobile
      ? crumbs.slice(0, crumbs.length - 1)
      : crumbs.slice(1, crumbs.length - 1);

  const items: ReactNode[] = [];
  if (collapsed && !isMobile) {
    items.push(
      <Link key={crumbs[0].key} to={crumbs[0].url} className={styles.crumbLink}>
        {crumbs[0].name}
      </Link>,
    );
  }
  if (collapsed) {
    items.push(
      <Menu shadow="md" position="bottom-start" key="hidden">
        <Menu.Target>
          <button
            type="button"
            className={styles.crumbEllipsis}
            aria-label={t("Show hidden pages")}
          >
            …
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {hidden.map((item) => (
            <Menu.Item key={item.key} component={Link} to={item.url}>
              {item.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>,
    );
  }
  const trailing = collapsed ? [crumbs[crumbs.length - 1]] : crumbs;
  for (const crumb of trailing) {
    items.push(
      <Link key={crumb.key} to={crumb.url} className={styles.crumbLink}>
        {crumb.name}
      </Link>,
    );
  }

  return (
    <nav className={styles.breadcrumbs} aria-label={t("Breadcrumb")}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className={styles.crumbSeparator} aria-hidden>
              /
            </span>
          )}
          {item}
        </Fragment>
      ))}
    </nav>
  );
}
