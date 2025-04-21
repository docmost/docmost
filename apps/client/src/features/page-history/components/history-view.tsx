import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";

interface HistoryProps {
  historyId: string;
}

function HistoryView({ historyId }: HistoryProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePageHistoryQuery(historyId);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    data && (
      <div>
        <HistoryEditor content={data.content} title={data.title} />
      </div>
    )
  );
}

export default HistoryView;
