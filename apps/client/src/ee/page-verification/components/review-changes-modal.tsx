import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  getDefaultZIndex,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import HistoryDiffBar from "@/features/page-history/components/history-diff-bar";
import { useDiffNavigation } from "@/features/page-history/hooks";
import { diffCountsAtom } from "@/features/page-history/atoms/history-atoms";
import { normalizeHistoryTitle } from "@/features/page-history/utils/normalize-history-title";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { reviewChangesAtom } from "@/ee/page-verification/atoms/review-changes-atom";
import {
  usePageVerificationChangesQuery,
  usePageVerificationInfoQuery,
} from "@/ee/page-verification/queries/page-verification-query";
import {
  containsDiagram,
  getBaselineCopy,
  getDefaultBaselineKind,
} from "@/ee/page-verification/page-verification.utils";
import {
  ReviewChangesRequest,
  VerificationChangesBaselineKind,
} from "@/ee/page-verification/types/page-verification.types";
import classes from "./review-changes-modal.module.css";

type ReviewChangesModalProps = {
  pageId: string;
  onOpenVerification: () => void;
};

export function ReviewChangesModal({
  pageId,
  onOpenVerification,
}: ReviewChangesModalProps) {
  const { t } = useTranslation();
  const [reviewChanges, setReviewChanges] = useAtom(reviewChangesAtom);
  const isMobile = useMediaQuery("(max-width: 800px)");
  const opened = reviewChanges?.pageId === pageId;

  // a request left over from this page must not reopen the dialog later
  useEffect(
    () => () =>
      setReviewChanges((current) =>
        current?.pageId === pageId ? null : current,
      ),
    [pageId, setReviewChanges],
  );

  // deferred so a verification modal's Escape listener for this keypress still sees the review open
  const close = () => {
    setTimeout(
      () =>
        setReviewChanges((current) =>
          current?.pageId === pageId ? null : current,
        ),
      0,
    );
  };

  return (
    <Modal.Root
      opened={opened}
      onClose={close}
      size={1000}
      fullScreen={isMobile}
      zIndex={getDefaultZIndex("modal") + 1}
      aria-label={t("Review changes")}
    >
      <Modal.Overlay />
      {/* className and style would also reach the centering wrapper */}
      <Modal.Content
        classNames={{ content: classes.content }}
        styles={{ content: { overflow: "hidden" } }}
      >
        <ReviewChangesContent
          pageId={pageId}
          opened={opened}
          source={reviewChanges?.source}
          isMobile={isMobile}
          onClose={close}
          onOpenVerification={onOpenVerification}
        />
      </Modal.Content>
    </Modal.Root>
  );
}

type ReviewChangesContentProps = {
  pageId: string;
  opened: boolean;
  source: ReviewChangesRequest["source"] | undefined;
  isMobile: boolean;
  onClose: () => void;
  onOpenVerification: () => void;
};

// mounted only while the dialog is open, so every open starts fresh
function ReviewChangesContent({
  pageId,
  opened,
  source: requestSource,
  isMobile,
  onClose,
  onOpenVerification,
}: ReviewChangesContentProps) {
  const { t } = useTranslation();
  // kept through the close transition, after the request is cleared
  const [source] = useState(requestSource);
  const [baselineChoice, setBaselineChoice] =
    useState<VerificationChangesBaselineKind | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [diffCounts, setDiffCounts] = useAtom(diffCountsAtom);

  const { data: info } = usePageVerificationInfoQuery(pageId);
  const { data: changes, isError } = usePageVerificationChangesQuery(
    pageId,
    opened,
  );
  const { currentChangeIndex, handlePrevChange, handleNextChange } =
    useDiffNavigation(scrollViewportRef);

  // diff counts are shared with page history; clear them on open and close
  useEffect(() => {
    setDiffCounts(null);
    return () => setDiffCounts(null);
  }, [setDiffCounts]);

  // info pointers stand in for the response while it loads, so the title is right early
  const defaultBaselineKind = getDefaultBaselineKind(
    changes ?? {
      verified: info?.verifiedHistoryId,
      rejected: info?.rejectedHistoryId,
    },
  );
  // a choice the latest response no longer offers falls back to the default
  const baselineKind =
    baselineChoice && (!changes || changes[baselineChoice])
      ? baselineChoice
      : (defaultBaselineKind ?? "verified");
  const baseline = changes?.[baselineKind] ?? null;
  // when and by whom the compared version was verified, approved or rejected
  const decision =
    baselineKind === "rejected"
      ? {
          date: changes?.rejected?.rejectedAt,
          user: changes?.rejected?.rejectedBy,
        }
      : {
          date: changes?.verified?.verifiedAt,
          user: changes?.verified?.verifiedBy,
        };
  const decisionTimeAgo = useTimeAgo(decision.date);
  const copy = getBaselineCopy(baselineKind, changes?.type ?? info?.type, t);

  const showsDiagramNote = useMemo(
    () =>
      !!changes &&
      !!baseline &&
      (containsDiagram(changes.current.content) ||
        containsDiagram(baseline.content)),
    [changes, baseline],
  );

  const canOpenVerification =
    source === "link" &&
    !!info?.permissions?.canVerify &&
    (info.status === "in_approval" ||
      info.status === "invalidated" ||
      info.status === "expired");

  const handleBaselineChange = (kind: VerificationChangesBaselineKind) => {
    setDiffCounts(null);
    setBaselineChoice(kind);
  };

  const handleOpenVerification = () => {
    onClose();
    onOpenVerification();
  };

  const documentProps = {
    className: classes.document,
    "data-mobile": isMobile || undefined,
  };
  // page history's document height; full screen on mobile
  const documentHeight = isMobile ? undefined : 650;

  let main: ReactNode;
  if (isError || (changes && !baseline)) {
    main = (
      <div {...documentProps}>
        <Text size="sm">{t("Error fetching page data.")}</Text>
      </div>
    );
  } else if (!changes) {
    main = (
      <div className={classes.main} aria-hidden="true">
        <div className={classes.meta}>
          <Stack gap="xs" py={5}>
            <Skeleton height={12} width={260} />
            <Skeleton height={12} width={180} />
          </Stack>
        </div>
        <Box h={documentHeight} {...documentProps}>
          <Skeleton height={32} width="45%" mb="xl" />
          <Stack gap="md">
            {["96%", "88%", "92%", "70%", "94%", "84%", "58%"].map(
              (width, index) => (
                <Skeleton key={index} height={12} width={width} />
              ),
            )}
          </Stack>
        </Box>
      </div>
    );
  } else {
    main = (
      <>
        <div className={classes.meta}>
          {changes.verified && changes.rejected && (
            <SegmentedControl<VerificationChangesBaselineKind>
              size="xs"
              aria-label={t("Compare with")}
              value={baselineKind}
              onChange={handleBaselineChange}
              data={[
                { label: t("Approved version"), value: "verified" },
                { label: t("Rejected version"), value: "rejected" },
              ]}
            />
          )}
          <div>
            {decision.date && (
              <Text size="sm" c="dimmed">
                {copy.byLine({
                  name: decision.user?.name ?? t("Someone"),
                  time: decisionTimeAgo,
                })}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {t("Compared with the current page.")}
            </Text>
          </div>
          {!baseline.hasChanges && <Text size="sm">{copy.matches}</Text>}
          {baseline.hasChanges && diffCounts?.total === 0 && (
            <Text size="sm">
              {t("Some changes, such as formatting, can't be highlighted.")}
            </Text>
          )}
          {showsDiagramNote && (
            <Text size="sm">
              {t("Diagrams always show their latest drawing.")}
            </Text>
          )}
        </div>

        <div className={classes.viewer}>
          <ScrollArea
            className={classes.scrollArea}
            h={documentHeight}
            viewportRef={scrollViewportRef}
            scrollbarSize={5}
          >
            <div {...documentProps}>
              <HistoryEditor
                title={normalizeHistoryTitle(changes.current.title)}
                content={changes.current.content}
                previousTitle={normalizeHistoryTitle(baseline.title)}
                previousContent={baseline.content}
              />
            </div>
          </ScrollArea>

          <HistoryDiffBar
            compact={isMobile}
            currentChangeIndex={currentChangeIndex}
            onPrev={handlePrevChange}
            onNext={handleNextChange}
            className={isMobile ? classes.floatingBar : undefined}
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Modal.Header>
        <Modal.Title>
          <Text size="md" fw={500}>
            {copy.title}
          </Text>
        </Modal.Title>
        <Modal.CloseButton aria-label={t("Close")} />
      </Modal.Header>

      <Modal.Body p={0} className={classes.body}>
        <div className={classes.main}>{main}</div>

        {canOpenVerification && (
          <Group justify="flex-end" gap="sm" className={classes.footer}>
            <Button variant="default" onClick={onClose}>
              {t("Close")}
            </Button>
            <Button color="dark" onClick={handleOpenVerification}>
              {t("Verify page")}
            </Button>
          </Group>
        )}
      </Modal.Body>
    </>
  );
}
