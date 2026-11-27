import { Link } from "react-router-dom";
import { Text } from "@mantine/core";
import { IconFile } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { BadgeOverflowList } from "@/ee/base/components/cells/badge-overflow";
import { useRelationRowHref } from "@/ee/base/hooks/use-relation-row-href";
import type { RelationPreview } from "@/ee/base/types/base.types";
import cellClasses from "@/ee/base/styles/cells.module.css";

type RelationReadListProps = {
  preview: RelationPreview | undefined;
  targetBaseId: string;
  measureKey?: string;
};

export function RelationReadList({
  preview,
  targetBaseId,
  measureKey,
}: RelationReadListProps) {
  const { t } = useTranslation();
  const rowHref = useRelationRowHref(targetBaseId);

  if (preview?.restricted) {
    return (
      <Text size="xs" c="dimmed">
        {preview.deleted ? t("Base deleted") : t("No access")}
      </Text>
    );
  }
  if (!preview || preview.count === 0) return null;

  const titles = preview.rows.map((row) => row.title || t("Untitled"));
  const chipClass = clsx(cellClasses.badge, cellClasses.pagePill);
  const chips = preview.rows.map((row, index) => {
    const label = (
      <>
        <IconFile size={14} stroke={1.75} aria-hidden className={cellClasses.pagePillIconFallback} />
        <span className={cellClasses.pagePillText}>{titles[index]}</span>
      </>
    );
    const href = rowHref(row.id);
    if (!href) {
      return (
        <span key={row.id} className={chipClass}>
          {label}
        </span>
      );
    }
    return (
      <Link
        key={row.id}
        to={href}
        className={chipClass}
        aria-label={t("Open {{name}}", { name: titles[index] })}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {label}
      </Link>
    );
  });
  return (
    <BadgeOverflowList
      chips={chips}
      measureKey={
        measureKey ??
        `${targetBaseId}:${preview.count}:${preview.rows.map((row) => `${row.id}:${row.title}`).join("|")}`
      }
      tooltipLabel={titles.join(", ")}
      extraCount={preview.count - preview.rows.length}
    />
  );
}
