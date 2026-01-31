import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";

interface HistoryProps {
  historyId: string;
  prevHistoryId?: string;
  highlightChanges?: boolean;
}

function HistoryView({ historyId, prevHistoryId, highlightChanges }: HistoryProps) {
  const { t } = useTranslation();
  const {
    data,
    isLoading: isLoadingCurrent,
    isError: isErrorCurrent,
  } = usePageHistoryQuery(historyId);
  const {
    data: prevData,
    isLoading: isLoadingPrev,
    isError: isErrorPrev,
  } = usePageHistoryQuery(prevHistoryId ?? "");

  if (isLoadingCurrent || isLoadingPrev) {
    return <></>;
  }

  if (isErrorCurrent || !data) {
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    data && (
      <div>
        <HistoryEditor
          content={data.content}
          title={data.title}
          previousContent={!isErrorPrev ? prevData?.content : undefined}
          highlightChanges={highlightChanges}
        />
      </div>
    )
  );
}

export default HistoryView;
