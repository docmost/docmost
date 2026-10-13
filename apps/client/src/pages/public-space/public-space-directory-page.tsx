import "@fontsource-variable/inter";
import "@/styles/public-typography.css";
import { useMemo, useState } from "react";
import { Skeleton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconSearch } from "@tabler/icons-react";
import { usePublicSpaceDirectoryQuery } from "@/features/public-space/queries/public-space-query.ts";
import { useAuthenticatedUser } from "@/features/public-space/hooks/use-authenticated-user.ts";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { getAvatarUrl } from "@/lib/config.ts";
import { Error404 } from "@/components/ui/error-404.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import styles from "@/features/public-space/components/docs/docs-hub.module.css";

const TILE_COLORS = [
  "#1f9d55",
  "#2b4bd6",
  "#7c3aed",
  "#0e7490",
  "#d9480f",
  "#b42318",
  "#a16207",
  "#475569",
  "#be185d",
  "#0f766e",
  "#4338ca",
  "#65a30d",
];

function getInitials(name: string) {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function PublicSpaceDirectoryPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = usePublicSpaceDirectoryQuery();
  const { data: currentUser } = useAuthenticatedUser();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [query, setQuery] = useState("");

  const spaces = useMemo(() => {
    const all = (data?.spaces ?? []).map((space, index) => ({
      ...space,
      color: TILE_COLORS[index % TILE_COLORS.length],
      initials: getInitials(space.name),
    }));
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (space) =>
        space.name.toLowerCase().includes(needle) ||
        space.description?.toLowerCase().includes(needle),
    );
  }, [data?.spaces, query]);

  if (isError) {
    if ([401, 403, 404].includes(error?.["response"]?.status)) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  const total = data?.spaces.length ?? 0;
  const title = t("Documentation");
  const searchLabel = isMobile ? t("Search...") : t("Search documentation...");

  return (
    <div className={clsx(styles.root, "public-typography")}>
      <SkipToMain />

      <DocumentTitle title={title} withAppName={false} />

      <div className={styles.topBar}>
        <div className={clsx(styles.container, styles.topBarInner)}>
          <Link to="/docs" className={styles.brand}>
            <span className={styles.brandTile} aria-hidden>
              {title.charAt(0).toUpperCase()}
            </span>
            <span>{title}</span>
          </Link>

          <div className={styles.topActions}>
            {currentUser?.user ? (
              <Link to="/home" className={styles.signIn}>
                {t("Open app")}
              </Link>
            ) : (
              <Link to="/login" className={styles.signIn}>
                {t("Sign in")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <header className={styles.hero}>
        <div className={clsx(styles.container, styles.heroInner)}>
          <h1 className={styles.heading}>
            {t("Welcome to our documentation")}
          </h1>
          <p className={styles.subtitle}>
            {isMobile
              ? t("Guides, references and answers across all our spaces.")
              : t(
                  "Guides, references and answers across all our published spaces.",
                )}
          </p>

          <form
            className={styles.search}
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
            />
            <button
              type="submit"
              className={styles.searchButton}
              aria-label={t("Search")}
            >
              <IconSearch size={isMobile ? 16 : 18} stroke={2.4} aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
        <div className={clsx(styles.container, styles.mainInner)}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t("Spaces")}</h2>
            {!isLoading && (
              <span className={styles.sectionCount}>
                {total === 1
                  ? t("1 published space")
                  : t("{{count}} published spaces", { count: total })}
              </span>
            )}
          </div>

          {isLoading && (
            <div className={styles.grid} aria-hidden>
              <Skeleton height={220} radius={14} />
              <Skeleton height={220} radius={14} />
              <Skeleton height={220} radius={14} />
              <Skeleton height={220} radius={14} />
            </div>
          )}

          {!isLoading && total === 0 && (
            <p className={styles.empty}>{t("No public spaces yet.")}</p>
          )}

          {!isLoading && total > 0 && spaces.length === 0 && (
            <p className={styles.empty}>
              {t("No spaces match your search.")}
            </p>
          )}

          {spaces.length > 0 && (
            <div className={styles.grid}>
              {spaces.map((space) => {
                const logoUrl = getAvatarUrl(
                  space.logo,
                  AvatarIconType.SPACE_ICON,
                );
                return (
                  <Link
                    key={space.slug}
                    to={buildPublicSpaceUrl({ spaceSlug: space.slug })}
                    className={styles.card}
                  >
                    <span className={styles.cardHeader}>
                      <span
                        className={styles.cardTile}
                        style={{ backgroundColor: space.color }}
                        aria-hidden
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="" />
                        ) : (
                          space.initials
                        )}
                      </span>
                      <span className={styles.cardName}>{space.name}</span>
                    </span>
                    {space.description && (
                      <span className={styles.cardDescription}>
                        {space.description}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {data && (
        <footer className={styles.footer}>
          <div className={clsx(styles.container, styles.footerInner)}>
            <div>
              Powered by{" "}
              <a
                className={styles.footerBranding}
                href="https://docmost.com?ref=public-space"
                target="_blank"
                rel="noreferrer"
              >
                Docmost
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
