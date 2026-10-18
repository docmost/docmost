import { useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";
import { useDiffNavigation } from "@/features/page-history/hooks/use-diff-navigation";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import {
  usePageVerificationInfoQuery,
  useVerifyPageMutation,
} from "@/ee/page-verification/queries/page-verification-query";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { RequestChangesModal } from "./request-changes-modal";

type ApprovalCompareMode = "review" | "compare";

type ApprovalCompareModalProps = {
  pageId: string;
  opened: boolean;
  onClose: () => void;
  // Review shows the frozen submission to approvers; compare shows the current draft.
  mode: ApprovalCompareMode;
};

export function ApprovalCompareModal({
  pageId,
  opened,
  onClose,
  mode,
}: ApprovalCompareModalProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 800px)");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={900}
      fullScreen={isMobile}
      title={mode === "review" ? t("Review changes") : t("Draft changes")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      {opened && <CompareBody pageId={pageId} mode={mode} onClose={onClose} />}
    </Modal>
  );
}

type CompareBodyProps = {
  pageId: string;
  mode: ApprovalCompareMode;
  onClose: () => void;
};

function CompareBody({ pageId, mode, onClose }: CompareBodyProps) {
  const { t } = useTranslation();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const { data: info } = usePageVerificationInfoQuery(pageId);
  const { data: page } = usePageQuery({ pageId });
  const pageEditor = useAtomValue(pageEditorAtom);
  const verifyMutation = useVerifyPageMutation();
  const [requestChangesOpened, setRequestChangesOpened] = useState(false);
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const diffCounts = useAtomValue(diffCountsAtom);
  const { currentChangeIndex, handlePrevChange, handleNextChange } =
    useDiffNavigation(scrollViewportRef);

  // The live editor is ahead of the page query, which only catches up every few seconds.
  const [liveDraft] = useState(() =>
    mode === "compare" && pageEditor && !pageEditor.isDestroyed
      ? pageEditor.getJSON()
      : null,
  );

  const base = info?.latestReaderVersion ?? null;
  const baseQuery = usePageHistoryQuery(base?.id ?? "");
  const reviewing = mode === "review";
  const pendingQuery = usePageHistoryQuery(
    reviewing ? (info?.pendingHistoryId ?? "") : "",
  );
  const submittedAgo = useTimeAgo(
    info?.pendingSubmission?.requestedAt ?? info?.requestedAt ?? undefined,
  );

  if (!info) {
    return <Loading />;
  }

  if (reviewing && (info.status !== "in_approval" || !info.pendingHistoryId)) {
    return (
      <Text size="sm" c="dimmed">
        {t("This submission is no longer in review.")}
      </Text>
    );
  }

  const baseVersion = baseQuery.data;
  const submission = reviewing ? pendingQuery.data : undefined;
  const next = reviewing
    ? submission
    : {
        title: page?.title,
        icon: page?.icon,
        content: liveDraft ?? page?.content,
      };

  if (baseQuery.isError || pendingQuery.isError) {
    return <Text size="sm">{t("Error fetching page data.")}</Text>;
  }

  if ((base && !baseVersion) || !next?.content) {
    return <Loading />;
  }

  const titleChanged =
    !!baseVersion && (baseVersion.title ?? "") !== (next.title ?? "");
  const iconChanged =
    !!baseVersion && (baseVersion.icon ?? "") !== (next.icon ?? "");
  const summary = info.pendingSubmission?.changeSummary;
  const requester = info.pendingSubmission?.requestedBy ?? info.requestedBy;
  const canVerify = reviewing && !!info.permissions?.canVerify;

  const handleApprove = () => {
    // Approve exactly the submission on screen, not whatever is pending by now.
    verifyMutation.mutate(
      { pageId, pendingHistoryId: submission.id },
      { onSuccess: onClose },
    );
  };

  return (
    <Stack gap="sm">
      {reviewing && (
        <div>
          <Text size="sm">
            {t("Submitted by {{name}} {{time}}", {
              name: requester?.name ?? t("Someone"),
              time: submittedAgo,
            })}
          </Text>
          {summary && (
            <Paper withBorder radius="sm" p="sm" mt="xs">
              <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={2}>
                {t("Change summary")}
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {summary}
              </Text>
            </Paper>
          )}
        </div>
      )}

      <Text size="sm" c="dimmed">
        {!base
          ? t("There is no earlier version to compare with.")
          : base.kind === "approved" && base.number != null
            ? t("Compared with version {{n}}", { n: base.number })
            : t("Compared with the content readers see now")}
      </Text>

      {(titleChanged || iconChanged) && (
        <Paper withBorder radius="sm" p="sm">
          <Stack gap={6}>
            {titleChanged && (
              <ChangeRow
                label={t("Title")}
                before={baseVersion.title || t("Untitled")}
                after={next.title || t("Untitled")}
              />
            )}
            {iconChanged && (
              <ChangeRow
                label={t("Icon")}
                before={baseVersion.icon || t("None")}
                after={next.icon || t("None")}
              />
            )}
          </Stack>
        </Paper>
      )}

      {baseVersion && (
        <Group justify="space-between" wrap="nowrap">
          <Switch
            label={t("Highlight changes")}
            checked={highlightChanges}
            onChange={(event) =>
              setHighlightChanges(event.currentTarget.checked)
            }
            styles={{ label: { userSelect: "none", whiteSpace: "nowrap" } }}
          />
          {highlightChanges && diffCounts && diffCounts.total > 0 && (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {t("{{current}} of {{total}}", {
                  current: currentChangeIndex,
                  total: diffCounts.total,
                })}
              </Text>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handlePrevChange}
                aria-label={t("Previous change")}
              >
                <IconChevronUp size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleNextChange}
                aria-label={t("Next change")}
              >
                <IconChevronDown size={16} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      )}

      <ScrollArea h="55vh" scrollbarSize={5} viewportRef={scrollViewportRef}>
        <Box px="md" pb="md">
          <HistoryEditor
            title={next.title}
            content={next.content}
            previousContent={baseVersion?.content}
          />
        </Box>
      </ScrollArea>

      {canVerify && (
        <>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              onClick={() => setRequestChangesOpened(true)}
            >
              {t("Request changes")}
            </Button>
            <Button
              color="dark"
              onClick={handleApprove}
              loading={verifyMutation.isPending}
            >
              {t("Approve")}
            </Button>
          </Group>
          <RequestChangesModal
            pageId={pageId}
            opened={requestChangesOpened}
            onClose={() => setRequestChangesOpened(false)}
            onDone={onClose}
          />
        </>
      )}
    </Stack>
  );
}

function Loading() {
  return (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  );
}

type ChangeRowProps = {
  label: string;
  before: string;
  after: string;
};

function ChangeRow({ label, before, after }: ChangeRowProps) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="xs" fw={600} tt="uppercase" c="dimmed" w={48}>
        {label}
      </Text>
      <Text size="sm" td="line-through" c="red.7" lineClamp={1}>
        {before}
      </Text>
      <IconArrowRight size={14} aria-hidden="true" />
      <Text size="sm" c="teal.8" lineClamp={1}>
        {after}
      </Text>
    </Group>
  );
}
