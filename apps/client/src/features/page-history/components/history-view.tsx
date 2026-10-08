import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
} from "@/features/page-history/atoms/history-atoms";

interface Props {
  historyId?: string;
  prevHistoryId?: string;
}

function HistoryView({ historyId, prevHistoryId }: Props) {
  const { t } = useTranslation();
  const activeId = useAtomValue(activeHistoryIdAtom);
  const activePrevId = useAtomValue(activeHistoryPrevIdAtom);

  const resolvedId = historyId ?? activeId;
  const resolvedPrevId = prevHistoryId ?? activePrevId;

  const {
    data,
    isLoading: isLoadingCurrent,
    isError: isErrorCurrent,
  } = usePageHistoryQuery(resolvedId);
  const {
    data: prevData,
    isLoading: isLoadingPrev,
    isError: isErrorPrev,
  } = usePageHistoryQuery(resolvedPrevId);

  if (isLoadingCurrent || isLoadingPrev) {
    return <></>;
  }

  if (isErrorCurrent || !data) {
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <div>
      <HistoryEditor
        content={data.content}
        title={data.title}
        previousContent={!isErrorPrev ? prevData?.content : undefined}
      />
    </div>
  );
}

export default HistoryView;
