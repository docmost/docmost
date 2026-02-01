import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import {
  DiffCounts,
  HistoryEditor,
  HistoryEditorHandle,
} from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";
import { forwardRef } from "react";

interface HistoryProps {
  historyId: string;
  prevHistoryId?: string;
  highlightChanges?: boolean;
  onDiffCalculated?: (counts: DiffCounts) => void;
}

const HistoryView = forwardRef<HistoryEditorHandle, HistoryProps>(
  function HistoryView(
    { historyId, prevHistoryId, highlightChanges, onDiffCalculated },
    ref,
  ) {
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
            ref={ref}
            content={data.content}
            title={data.title}
            previousContent={!isErrorPrev ? prevData?.content : undefined}
            highlightChanges={highlightChanges}
            onDiffCalculated={onDiffCalculated}
          />
        </div>
      )
    );
  },
);

export default HistoryView;
