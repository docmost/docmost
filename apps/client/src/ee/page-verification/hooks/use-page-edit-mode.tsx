import { useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { unlockedVerifiedPageIdAtom } from "@/ee/page-verification/atoms/page-edit-lock-atom";
import { LOCKED_VERIFICATION_STATUSES } from "@/ee/page-verification/page-verification.constants";
import { VerificationStatus } from "@/ee/page-verification/types/page-verification.types";

function isLockedStatus(status: VerificationStatus | undefined): boolean {
  return LOCKED_VERIFICATION_STATUSES.includes(status);
}

function usePageVerificationStatus(
  pageId: string | undefined,
): VerificationStatus | undefined {
  const hasVerificationFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const { data: verificationInfo } = usePageVerificationInfoQuery(
    hasVerificationFeature ? pageId : undefined,
  );
  return verificationInfo?.status;
}

function getEditConfirmation(
  status: VerificationStatus,
  t: (key: string) => string,
) {
  switch (status) {
    case "approved":
      return {
        title: t("Edit approved page?"),
        message: t(
          "Changes return this page to draft. It has to be approved again.",
        ),
      };
    case "in_approval":
      return {
        title: t("Edit page in approval?"),
        message: t(
          "Changes withdraw the approval request and return this page to draft.",
        ),
      };
    default:
      return {
        title: t("Edit verified page?"),
        message: t(
          "Changes remove the verification until a verifier verifies the page again.",
        ),
      };
  }
}

export function usePageEditMode(pageId?: string) {
  const { t } = useTranslation();
  const status = usePageVerificationStatus(pageId);
  const isLocked = isLockedStatus(status);
  const [sessionMode, setSessionMode] = useAtom(currentPageEditModeAtom);
  const [unlockedPageId, setUnlockedPageId] = useAtom(
    unlockedVerifiedPageIdAtom,
  );

  const editMode =
    unlockedPageId === pageId
      ? PageEditMode.Edit
      : isLocked
        ? PageEditMode.Read
        : sessionMode;

  const changeEditMode = (mode: PageEditMode) => {
    if (!isLocked) {
      setSessionMode(mode);
      setUnlockedPageId(null);
      return;
    }

    if (mode === PageEditMode.Read) {
      setUnlockedPageId(null);
      return;
    }

    const { title, message } = getEditConfirmation(status, t);
    modals.openConfirmModal({
      title,
      children: <Text size="sm">{message}</Text>,
      centered: true,
      labels: { confirm: t("Edit"), cancel: t("Cancel") },
      onConfirm: () => setUnlockedPageId(pageId),
    });
  };

  return { editMode, isLocked, changeEditMode };
}

export function usePageEditLockSync(pageId: string): void {
  const status = usePageVerificationStatus(pageId);
  const setUnlockedPageId = useSetAtom(unlockedVerifiedPageIdAtom);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    return () => setUnlockedPageId(null);
  }, [pageId, setUnlockedPageId]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    // previous status is undefined while loading, so the first load never counts
    const enteredLockedStatus =
      !!previousStatus && previousStatus !== status && isLockedStatus(status);
    if (enteredLockedStatus) setUnlockedPageId(null);
  }, [status, setUnlockedPageId]);
}
