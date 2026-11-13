import { Loader, Tooltip } from "@mantine/core";
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
  const label =
    processedRows > 0
      ? t("{{processed}} of {{total}} rows", {
          processed: processedRows.toLocaleString(i18n.language),
          total: totalRows.toLocaleString(i18n.language),
        })
      : t("Waiting to start");

  return (
    <Tooltip label={label} withinPortal>
      <div className={classes.importIndicator} role="status" aria-live="polite" aria-label={label}>
        <Loader size={12} />
        {processedRows > 0
          ? t("Importing {{percent}}%", { percent })
          : t("Importing…")}
      </div>
    </Tooltip>
  );
}
