import { KeyboardEvent, useState } from "react";
import { ActionIcon } from "@mantine/core";
import { IconChevronRight, IconFileDescription } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IPage } from "@/features/page/types/page.types";
import { PageChildren } from "./page-children";
import classes from "./destination-picker.module.css";

type PageRowProps = {
  page: Partial<IPage>;
  depth: number;
  limit: number;
  selectedId: string | null;
  excludePageId?: string;
  onSelect: (page: Partial<IPage>) => void;
};

export function PageRow({
  page,
  depth,
  limit,
  selectedId,
  excludePageId,
  onSelect,
}: PageRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const isExcluded = page.id === excludePageId;
  const isSelected = page.id === selectedId;

  const rowClasses = [
    classes.pageRow,
    isSelected && classes.selected,
    isExcluded && classes.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  const handleSelect = () => {
    if (!isExcluded) onSelect(page);
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  };

  return (
    <>
      <div
        className={rowClasses}
        style={{ paddingLeft: depth * 20 + 12 }}
        role="button"
        tabIndex={isExcluded ? -1 : 0}
        aria-disabled={isExcluded || undefined}
        onClick={handleSelect}
        onKeyDown={handleRowKeyDown}
      >
        {page.hasChildren ? (
          <ActionIcon
            className={`${classes.chevron} ${expanded ? classes.chevronExpanded : ""}`}
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={expanded ? t("Collapse") : t("Expand")}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        ) : (
          <div style={{ width: 20, flexShrink: 0 }} />
        )}

        <div className={classes.iconWrapper}>
          {page.icon ? (
            page.icon
          ) : (
            <ActionIcon
              component="div"
              variant="transparent"
              c="gray"
              size={22}
            >
              <IconFileDescription size={18} />
            </ActionIcon>
          )}
        </div>

        <div className={classes.pageTitle}>
          {page.title || t("Untitled")}
        </div>
      </div>

      {expanded && page.hasChildren && (
        <PageChildren
          spaceId={page.spaceId}
          pageId={page.id}
          depth={depth + 1}
          limit={limit}
          selectedId={selectedId}
          excludePageId={excludePageId}
          onSelectPage={onSelect}
        />
      )}
    </>
  );
}
