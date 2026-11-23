import { Loader, RingProgress, Tooltip, VisuallyHidden } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { baseImportProgressAtomFamily } from "@/ee/base/atoms/base-atoms";
import classes from "@/ee/base/styles/csv-import.module.css";

export function BaseImportIndicator({ pageId }: { pageId: string }) {
  const { t, i18n } = useTranslation();
  const progress = useAtomValue(baseImportProgressAtomFamily(pageId));
  if (!progress) return null;

  const { processedRows, totalRows } = progress;
  const percent = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 100)) : 0;
  const started = processedRows > 0;
  const label = started
    ? t("{{processed}} of {{total}} rows", {
        processed: processedRows.toLocaleString(i18n.language),
        total: totalRows.toLocaleString(i18n.language),
      })
    : t("Waiting to start");

  // the percentage is visual only, so screen readers hear the start once instead of every step
  return (
    <Tooltip label={label} withinPortal>
      <div className={classes.importIndicator}>
        {started ? (
          <RingProgress
            size={18}
            thickness={2.5}
            roundCaps
            sections={[{ value: percent, color: "var(--mantine-primary-color-filled)" }]}
            aria-hidden
          />
        ) : (
          <Loader size={12} />
        )}
        <span aria-hidden>
          {started ? t("Importing {{percent}}%", { percent }) : t("Importing…")}
        </span>
        <VisuallyHidden role="status">{t("Importing…")}</VisuallyHidden>
      </div>
    </Tooltip>
  );
}
