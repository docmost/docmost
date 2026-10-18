import {
  ActionIcon,
  Group,
  Menu,
  Modal,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconRosetteDiscountCheckFilled,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { isReaderOfControlledPage } from "@/features/page/page.utils";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { Feature } from "@/ee/features";
import { SetupVerificationForm } from "./setup-verification-form";
import { ManageVerificationForm } from "./manage-verification-form";
import { LimitedVerificationForm } from "./limited-verification-form";
import { ReaderApprovalBadge } from "./reader-approval-badge";
import { getStatusColor, getStatusLabel } from "./verification-status";

type PageVerificationModalProps = {
  pageId: string;
  opened: boolean;
  onClose: () => void;
};

export function PageVerificationModal({
  pageId,
  opened,
  onClose,
}: PageVerificationModalProps) {
  const { t } = useTranslation();
  const hasVerificationFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const { data: verificationInfo } = usePageVerificationInfoQuery(
    opened ? pageId : undefined,
  );

  const status = verificationInfo?.status ?? "none";
  const title = !hasVerificationFeature
    ? t("Remove verification")
    : status === "none"
      ? t("Set up verification")
      : t("Verify page");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      aria-label={title}
      title={
        <Group gap="xs">
          <IconShieldCheck
            size={20}
            stroke={1.5}
            color={
              status === "verified" || status === "approved"
                ? "var(--mantine-color-blue-6)"
                : status === "expired"
                  ? "var(--mantine-color-red-6)"
                  : undefined
            }
          />
          <Text fw={600}>{title}</Text>
        </Group>
      }
      size={520}
    >
      {!hasVerificationFeature ? (
        <LimitedVerificationForm pageId={pageId} onClose={onClose} />
      ) : status === "none" ? (
        <SetupVerificationForm pageId={pageId} onClose={onClose} />
      ) : (
        <ManageVerificationForm pageId={pageId} onClose={onClose} />
      )}
    </Modal>
  );
}

type PageVerificationBadgeProps = {
  readOnly?: boolean;
};

export function PageVerificationBadge({
  readOnly,
}: PageVerificationBadgeProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const hasVerificationFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const [opened, { open, close }] = useDisclosure(false);
  const setHistoryModalOpen = useSetAtom(historyAtoms);

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;

  // Without the licence only approval can still be removed, so only controlled pages are looked up.
  const looksUpRemoval =
    !hasVerificationFeature && page?.approval?.controlled === true;
  const { data: verificationInfo, isLoading } = usePageVerificationInfoQuery(
    hasVerificationFeature || looksUpRemoval ? pageId : undefined,
  );
  const upgradeLabel = useUpgradeLabel();

  if (!pageId) return null;
  if (looksUpRemoval && isLoading) return null;

  const canRemoveWithoutLicence =
    looksUpRemoval && !!verificationInfo?.permissions?.canRemove;
  if (!hasVerificationFeature && !canRemoveWithoutLicence) {
    if (readOnly) return null;
    const lockedLabel = `${t("Add verification")} — ${upgradeLabel}`;
    // Use ActionIcon (a real <button>) instead of a ThemeIcon so the tooltip
    // is reachable on keyboard focus, and screen readers announce the upgrade
    // hint via the accessible name. Click is a no-op since the feature is
    // gated; the tooltip explains why.
    return (
      <Tooltip label={lockedLabel} withArrow openDelay={250}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={lockedLabel}
        >
          <IconShieldCheck size={20} stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    );
  }
  if (isLoading) return null;

  if (isReaderOfControlledPage(page)) {
    return verificationInfo ? (
      <ReaderApprovalBadge info={verificationInfo} />
    ) : null;
  }

  const status = verificationInfo?.status ?? "none";

  if (status === "none" && readOnly) return null;

  // Once approved, edits wait in the draft until the next approval.
  const hasDraftChanges =
    status === "approved" && verificationInfo?.hasDraftChanges === true;

  const statusLabel =
    status === "verified" && verificationInfo?.expiresAt
      ? t("Verified until {{date}}", {
          date: new Date(verificationInfo.expiresAt).toLocaleDateString(
            i18n.language,
            { month: "long", day: "numeric", year: "numeric" },
          ),
        })
      : getStatusLabel(status, t);
  const tooltipLabel = hasDraftChanges
    ? t("{{status}}, draft changes", { status: statusLabel })
    : statusLabel;

  return (
    <>
      {status !== "none" ? (
        <Tooltip label={tooltipLabel} withArrow openDelay={250}>
          <UnstyledButton
            onClick={open}
            aria-label={tooltipLabel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            <IconRosetteDiscountCheckFilled
              size={18}
              color={`var(--mantine-color-${getStatusColor(status).replace(".", "-")})`}
              aria-hidden="true"
            />
            <Text size="sm" c={getStatusColor(status)}>
              {getStatusLabel(status, t)}
            </Text>
            {hasDraftChanges && (
              <Text size="sm" c="orange.8">
                &middot; {t("Draft changes")}
              </Text>
            )}
          </UnstyledButton>
        </Tooltip>
      ) : !readOnly ? (
        <Tooltip label={t("Set up verification")} withArrow openDelay={250}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t("Set up verification")}
            onClick={open}
          >
            <IconShieldCheck size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      {status !== "none" && verificationInfo?.editedSinceVerified && (
        <UnstyledButton
          onClick={() => setHistoryModalOpen(true)}
          aria-haspopup="dialog"
        >
          <Text size="sm" c="orange.8" td="underline">
            {t("Edited since verified")}
          </Text>
        </UnstyledButton>
      )}

      <PageVerificationModal pageId={pageId} opened={opened} onClose={close} />
    </>
  );
}

type PageVerificationMenuItemProps = {
  pageId?: string;
  onClick: () => void;
};

export function PageVerificationMenuItem({
  pageId,
  onClick,
}: PageVerificationMenuItemProps) {
  const { t } = useTranslation();
  const hasVerificationFeature = useHasFeature(Feature.PAGE_VERIFICATION);
  const upgradeLabel = useUpgradeLabel();
  const { data: page } = usePageQuery({ pageId });

  // Without the licence only approval can still be removed, so only controlled pages are looked up.
  const looksUpRemoval =
    !hasVerificationFeature && page?.approval?.controlled === true;
  const { data: verificationInfo } = usePageVerificationInfoQuery(
    hasVerificationFeature || looksUpRemoval ? pageId : undefined,
  );

  const hasVerification =
    !!verificationInfo && verificationInfo.status !== "none";
  const label = hasVerification
    ? t("Edit verification")
    : t("Add verification");
  const enabled =
    hasVerificationFeature ||
    (looksUpRemoval && !!verificationInfo?.permissions?.canRemove);

  const menuItem = (
    <Menu.Item
      disabled={!enabled}
      leftSection={<IconShieldCheck size={16} />}
      onClick={enabled ? onClick : undefined}
    >
      {label}
    </Menu.Item>
  );

  if (!enabled) {
    return (
      <Tooltip label={upgradeLabel} position="left" withinPortal={false}>
        {menuItem}
      </Tooltip>
    );
  }

  return menuItem;
}
