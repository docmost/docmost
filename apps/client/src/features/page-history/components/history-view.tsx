import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";

interface HistoryProps {
  historyId: string;
  previousHistoryId?: string;
}

function HistoryView({ historyId, previousHistoryId }: HistoryProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePageHistoryQuery(historyId);
  const { data: previousData, isLoading: isPrevLoading } = usePageHistoryQuery(previousHistoryId || "");

  if (isLoading || (previousHistoryId && isPrevLoading)) {
    return <></>;
  }

  if (isError || !data) {
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <HistoryEditor
      content={data.content}
      title={data.title}
      previousContent={previousData?.content}
      previousTitle={previousData?.title}
    />
  );
}

export default HistoryView;
