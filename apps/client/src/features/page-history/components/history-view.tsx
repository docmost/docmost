import { Alert } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
} from "@/features/page-history/atoms/history-atoms";
import { useHistoryContent } from "@/features/page-history/hooks/use-history-content";

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

  // encrypted snapshots are decrypted client-side; plaintext ones pass through
  const current = useHistoryContent(data);
  const previous = useHistoryContent(!isErrorPrev ? prevData : undefined);

  // Wait for the previous version too: the two decrypt independently, and
  // rendering on the current one alone would show an undiffed document and
  // then re-run setContent once the previous arrived.
  if (
    isLoadingCurrent ||
    isLoadingPrev ||
    current.status === "decrypting" ||
    previous.status === "decrypting"
  ) {
    return <></>;
  }

  if (isErrorCurrent || !data) {
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (current.status === "locked") {
    return <div>{t("Unlock this page to view its history.")}</div>;
  }

  if (current.status === "error") {
    return <div>{t("Failed to decrypt this version.")}</div>;
  }

  // the current version is readable; only the diff base is missing, so warn
  // instead of hiding the version the user asked for
  const previousFailed =
    isErrorPrev ||
    previous.status === "error" ||
    (!!prevHistoryId && previous.status === "locked");

  return (
    <div>
      {previousFailed && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={16} />}
          mb="md"
          variant="light"
        >
          {t(
            "The previous version could not be loaded, so changes are not highlighted.",
          )}
        </Alert>
      )}
      <HistoryEditor
        content={current.content}
        title={data.title}
        previousContent={
          previous.status === "ready"
            ? (previous.content ?? undefined)
            : undefined
        }
      />
    </div>
  );
}

export default HistoryView;
