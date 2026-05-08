import { useState } from "react";
import { Loader, Popover } from "@mantine/core";
import {
  IconChevronDown,
  IconCornerDownLeft,
  IconFile,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useReferencesQuery } from "@/features/transclusion/queries/transclusion-query";
import type { ReferencingPage } from "@/features/transclusion/types/transclusion.types";
import { buildPageUrl } from "@/features/page/page.utils";
import classes from "./sync-block-references-dropdown.module.css";

type Props = {
  sourcePageId: string | null;
  transclusionId: string | null;
  /** The page currently being viewed - used to mark the "THIS PAGE" badge. */
  currentPageId: string;
  /**
   * Source: trigger reads "Editing original".
   * Reference: trigger reads "Synced to N other pages".
   */
  mode: "source" | "reference";
  /** Notified whenever the dropdown opens/closes (for keep-chrome-visible). */
  onOpenChange?: (open: boolean) => void;
};

export default function SyncBlockReferencesDropdown({
  sourcePageId,
  transclusionId,
  currentPageId,
  mode,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpened(next);
    onOpenChange?.(next);
  };

  // Fetch eagerly so the "Synced to N other pages" count is correct even
  // before the dropdown is opened. The cache is keyed on (sourcePageId,
  // transclusionId), so two views (source + reference) share one fetch.
  const enabled = !!sourcePageId && !!transclusionId;
  const { data, isLoading } = useReferencesQuery(
    sourcePageId,
    transclusionId,
    enabled,
  );

  const allPages: Array<{ page: ReferencingPage; isOriginal: boolean }> = [];
  if (data?.source) {
    allPages.push({ page: data.source, isOriginal: true });
  }
  for (const ref of data?.references ?? []) {
    allPages.push({ page: ref, isOriginal: false });
  }

  const otherCount = allPages.filter((p) => p.page.id !== currentPageId).length;
  const label =
    mode === "source"
      ? t("Editing original")
      : t("Synced to {{count}} other page", {
          count: otherCount,
          defaultValue_one: "Synced to {{count}} other page",
          defaultValue_other: "Synced to {{count}} other pages",
        });

  return (
    <Popover
      position="bottom-start"
      shadow="lg"
      opened={opened}
      onChange={handleOpenChange}
      width={340}
      withinPortal
    >
      <Popover.Target>
        <button
          type="button"
          className={classes.trigger}
          onClick={() => handleOpenChange(!opened)}
          aria-expanded={opened}
          aria-haspopup="dialog"
        >
          <span className={classes.triggerIcon}>
            <IconCornerDownLeft size={14} stroke={1.8} />
          </span>
          <span>{label}</span>
          <span className={classes.triggerChev}>
            <IconChevronDown size={12} stroke={2} />
          </span>
        </button>
      </Popover.Target>

      <Popover.Dropdown className={classes.dropdown}>
        {mode === "reference" && data?.source && (
          <div className={classes.banner}>
            <span className={classes.bannerIcon}>
              <IconInfoCircle size={16} stroke={1.6} />
            </span>
            <div>
              <Trans
                i18nKey="sourceReadOnlyHint"
                defaults="This section is read-only here. Edit it on the <link>original source page</link>."
                components={{
                  link: (
                    <Link
                      to={
                        data.source.spaceSlug
                          ? buildPageUrl(
                              data.source.spaceSlug,
                              data.source.slugId,
                              data.source.title,
                            )
                          : `/p/${data.source.id}`
                      }
                      className={classes.bannerLink}
                      onClick={() => handleOpenChange(false)}
                    />
                  ),
                }}
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className={classes.loading}>
            <Loader size="xs" />
          </div>
        ) : allPages.length === 0 ? (
          <div className={classes.empty}>{t("No pages")}</div>
        ) : (
          <div className={classes.section}>
            <div className={classes.sectionLabel}>{t("Synced to")}</div>
            <ul className={classes.list}>
              {allPages.map(({ page, isOriginal }) => {
                const isCurrent = page.id === currentPageId;
                const href = page.spaceSlug
                  ? buildPageUrl(page.spaceSlug, page.slugId, page.title)
                  : `/p/${page.id}`;
                const title = page.title?.length ? page.title : t("Untitled");
                return (
                  <li key={page.id}>
                    <Link
                      to={href}
                      className={classes.row}
                      onClick={() => handleOpenChange(false)}
                    >
                      {page.icon ? (
                        <span className={classes.rowEmoji}>{page.icon}</span>
                      ) : (
                        <span className={classes.rowIcon}>
                          <IconFile size={16} stroke={1.6} />
                        </span>
                      )}
                      <span className={classes.rowTitle} title={title}>
                        {title}
                      </span>
                      {isCurrent ? (
                        <span
                          className={`${classes.badge} ${classes.badgeAccent}`}
                        >
                          {t("THIS PAGE")}
                        </span>
                      ) : isOriginal ? (
                        <span className={classes.badge}>{t("ORIGINAL")}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
