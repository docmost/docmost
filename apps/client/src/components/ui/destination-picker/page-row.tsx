import { useState } from "react";
import { IconChevronRight, IconFile } from "@tabler/icons-react";
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

  return (
    <>
      <div
        className={rowClasses}
        style={{ paddingLeft: depth * 20 + 12 }}
        onClick={() => !isExcluded && onSelect(page)}
      >
        {page.hasChildren ? (
          <div
            className={`${classes.chevron} ${expanded ? classes.chevronExpanded : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <IconChevronRight size={14} />
          </div>
        ) : (
          <div style={{ width: 20, flexShrink: 0 }} />
        )}

        <div className={classes.iconWrapper}>
          {page.icon ? (
            page.icon
          ) : (
            <IconFile
              size={16}
              color="var(--mantine-color-gray-5)"
            />
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
