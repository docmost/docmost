import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
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
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import { HistoryDiffBar } from "@/features/page-history/components/history-diff-bar";
import { useDiffNavigation } from "@/features/page-history/hooks";
import { diffCountsAtom } from "@/features/page-history/atoms/history-atoms";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import { reviewChangesAtom } from "@/ee/page-verification/atoms/review-changes-atom";
import {
  usePageVerificationInfoQuery,
  useVerificationChangesQuery,
} from "@/ee/page-verification/queries/page-verification-query";
import {
  containsDiagram,
  getDefaultBaselineKind,
  normalizeReviewTitle,
} from "@/ee/page-verification/page-verification.utils";
import {
  IReviewChangesRequest,
  VerificationChangesBaselineKind,
  VerificationType,
} from "@/ee/page-verification/types/page-verification.types";
import classes from "./verification-changes-modal.module.css";

type VerificationChangesModalProps = {
  pageId: string;
  onOpenVerification: () => void;
};

export function VerificationChangesModal({
  pageId,
  onOpenVerification,
}: VerificationChangesModalProps) {
  const [review, setReview] = useAtom(reviewChangesAtom);
  const isMobile = useMediaQuery("(max-width: 800px)");
  const opened = review?.pageId === pageId;

  // a request left over from this page must not reopen the dialog later
  useEffect(
    () => () =>
      setReview((current) => (current?.pageId === pageId ? null : current)),
    [pageId, setReview],
  );

  // deferred so a verification modal's Escape listener for this keypress still sees the review open
  const close = () => {
    setTimeout(() => setReview(null), 0);
  };

  return (
    <Modal.Root
      opened={opened}
      onClose={close}
      size={1000}
      centered
      fullScreen={isMobile}
      zIndex={getDefaultZIndex("modal") + 1}
    >
      <Modal.Overlay />
      {/* className and style would also reach the centering wrapper */}
      <Modal.Content
        classNames={{ content: classes.content }}
        styles={{ content: { overflow: "hidden" } }}
        h={isMobile ? undefined : 820}
      >
        <VerificationChangesContent
          pageId={pageId}
          opened={opened}
          source={review?.source}
          isMobile={isMobile}
          onClose={close}
          onOpenVerification={onOpenVerification}
        />
      </Modal.Content>
    </Modal.Root>
  );
}

type VerificationChangesContentProps = {
  pageId: string;
  opened: boolean;
  source: IReviewChangesRequest["source"] | undefined;
  isMobile: boolean;
  onClose: () => void;
  onOpenVerification: () => void;
};

// mounted only while the dialog is open, so every open starts fresh
function VerificationChangesContent({
  pageId,
  opened,
  source: requestSource,
  isMobile,
  onClose,
  onOpenVerification,
}: VerificationChangesContentProps) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  // kept through the close transition, after the request is cleared
  const [source] = useState(requestSource);
  const [baselineChoice, setBaselineChoice] =
    useState<VerificationChangesBaselineKind | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [diffCounts, setDiffCounts] = useAtom(diffCountsAtom);

  const { data: info } = usePageVerificationInfoQuery(pageId);
  const { data: changes, isError } = useVerificationChangesQuery(
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
  const baselineKind = baselineChoice ?? defaultBaselineKind ?? "verified";
  const baseline = changes?.[baselineKind] ?? null;
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

  let main: ReactNode;
  if (isError || (changes && !baseline)) {
    main = (
      <div {...documentProps}>
        <Text size="sm">{t("Error fetching page data.")}</Text>
      </div>
    );
  } else if (!changes) {
    main = (
      <div
        role="status"
        aria-busy="true"
        aria-label={t("Loading changes")}
        className={classes.main}
      >
        <div className={classes.meta}>
          <Stack gap="xs" py={5}>
            <Skeleton height={12} width={260} />
            <Skeleton height={12} width={180} />
          </Stack>
        </div>
        <div {...documentProps}>
          <Skeleton height={32} width="45%" mb="xl" />
          <Stack gap="md">
            {["96%", "88%", "92%", "70%", "94%", "84%", "58%"].map(
              (width, index) => (
                <Skeleton key={index} height={12} width={width} />
              ),
            )}
          </Stack>
        </div>
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
            {baseline.at && (
              <Text size="sm" c="dimmed">
                {copy.byLine({
                  name: baseline.by?.name ?? t("Someone"),
                  date: formatLocalized(
                    baseline.at,
                    "MMM dd, yyyy, h:mma",
                    "PPp",
                    dateLocale,
                  ),
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
            viewportRef={scrollViewportRef}
            scrollbarSize={5}
          >
            <div {...documentProps}>
              <HistoryEditor
                title={normalizeReviewTitle(changes.current.title)}
                content={changes.current.content}
                previousTitle={normalizeReviewTitle(baseline.title)}
                previousContent={baseline.content}
              />
            </div>
          </ScrollArea>

          <HistoryDiffBar
            compact={isMobile}
            currentChangeIndex={currentChangeIndex}
            onPrev={handlePrevChange}
            onNext={handleNextChange}
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
              {t("Open verification")}
            </Button>
          </Group>
        )}
      </Modal.Body>
    </>
  );
}

type BaselineCopy = {
  title: string;
  byLine: (values: { name: string; date: string }) => string;
  matches: string;
};

function getBaselineCopy(
  kind: VerificationChangesBaselineKind,
  type: VerificationType | undefined,
  t: TFunction,
): BaselineCopy {
  if (kind === "rejected") {
    return {
      title: t("Changes since rejection"),
      byLine: (values) => t("Rejected by {{name}} on {{date}}", values),
      matches: t("The current page matches the rejected version."),
    };
  }

  if (type === "qms") {
    return {
      title: t("Changes since approval"),
      byLine: (values) => t("Approved by {{name}} on {{date}}", values),
      matches: t("The current page matches the approved version."),
    };
  }

  return {
    title: t("Changes since verification"),
    byLine: (values) => t("Verified by {{name}} on {{date}}", values),
    matches: t("The current page matches the verified version."),
  };
}
