import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { BadgeOverflowList } from "@/ee/base/components/cells/badge-overflow";
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

  if (preview?.restricted) {
    return (
      <Text size="xs" c="dimmed">
        {t("No access")}
      </Text>
    );
  }
  if (!preview || preview.count === 0) return null;

  const titles = preview.rows.map((row) => row.title || t("Untitled"));
  const chips = preview.rows.map((row, index) => (
    <span key={row.id} className={cellClasses.badge}>
      {titles[index]}
    </span>
  ));
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
