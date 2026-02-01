import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import {
  DiffCounts,
  HistoryEditor,
} from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";

interface HistoryProps {
  historyId: string;
  prevHistoryId?: string;
  highlightChanges?: boolean;
  onDiffCalculated?: (counts: DiffCounts) => void;
}

function HistoryView({
  historyId,
  prevHistoryId,
  highlightChanges,
  onDiffCalculated,
}: HistoryProps) {
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
          onDiffCalculated={onDiffCalculated}
        />
      </div>
    )
  );
}

export default HistoryView;
