import { useEffect, useRef } from "react";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useEntitlements } from "@/ee/entitlement/use-entitlements";
import type { Entitlements } from "@/ee/entitlement/entitlement.types";
import { Feature } from "@/ee/features";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { unlockedVerifiedPageIdAtom } from "@/ee/page-verification/atoms/page-edit-lock-atom";
import { LOCKED_VERIFICATION_STATUSES } from "@/ee/page-verification/page-verification.constants";
import {
  IPageVerificationInfo,
  VerificationStatus,
} from "@/ee/page-verification/types/page-verification.types";

function isLockedStatus(status: VerificationStatus | undefined): boolean {
  return LOCKED_VERIFICATION_STATUSES.includes(status);
}

// Builds without the enterprise server have no verification endpoint, so the page has no lock.
function isNotFound(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404;
}

// A buffered update or handshake may be sent before React renders an
// invalidation. Check the current permission at the point of transmission.
export function usePageSyncPermission(pageId: string) {
  const client = useQueryClient();
  const store = useStore();
  return () => {
    // Workspace features can only rule verification out. Otherwise the page's own status decides.
    const workspace = client.getQueryData<Entitlements>(["entitlements"]);
    if (workspace && !workspace.features.includes(Feature.PAGE_VERIFICATION))
      return true;
    // Edits wait while the lock status loads, then follow the last answer, even if a refresh failed.
    const lock = client.getQueryState<IPageVerificationInfo>([
      "page-verification-info",
      pageId,
    ]);
    if (!lock?.data) return isNotFound(lock?.error);
    if (lock.fetchStatus !== "idle") return false;
    return (
      !isLockedStatus(lock.data.status) ||
      store.get(unlockedVerifiedPageIdAtom) === pageId
    );
  };
}

function usePageVerificationStatus(
  pageId: string | undefined,
  checkOnEntry = false,
) {
  // Workspace features can only rule verification out. Otherwise the page's own status decides.
  const workspace = useEntitlements(Boolean(pageId));
  const verificationRuledOut = Boolean(
    workspace.data &&
      !workspace.data.features.includes(Feature.PAGE_VERIFICATION),
  );
  const verification = usePageVerificationInfoQuery(
    verificationRuledOut ? undefined : pageId,
    checkOnEntry,
  );
  // Only the first lock answer can pause editing. A refresh, running or failed, keeps the last one.
  const awaitingLockStatus = Boolean(
    pageId &&
      !verificationRuledOut &&
      !verification.data &&
      !isNotFound(verification.error),
  );
  const verificationUnavailable =
    awaitingLockStatus &&
    (verification.isError ||
      verification.isPaused ||
      (verification.isFetching &&
        verification.errorUpdatedAt > verification.dataUpdatedAt));
  return {
    status: verification.data?.status,
    isCheckingLock: awaitingLockStatus,
    verificationUnavailable,
    retryVerification: verification.refetch,
    retryingVerification: verification.isFetching,
  };
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
  const { status, ...verification } = usePageVerificationStatus(pageId);
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

  return { editMode, isLocked, ...verification, changeEditMode };
}

// Checks the lock as soon as a page is opened, by slug until its id is known.
export function usePageEditLockCheck(pageKey: string | undefined): void {
  usePageVerificationStatus(pageKey, true);
}

export function usePageEditLockSync(pageId: string): void {
  const { status } = usePageVerificationStatus(pageId);
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
