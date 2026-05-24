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
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { Feature } from "@/ee/features";
import { SetupVerificationForm } from "./setup-verification-form";
import { ManageVerificationForm } from "./manage-verification-form";
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
  const { data: verificationInfo } = usePageVerificationInfoQuery(
    opened ? pageId : undefined,
  );

  const status = verificationInfo?.status ?? "none";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      aria-label={status === "none" ? t("Set up verification") : t("Verify page")}
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
          <Text fw={600}>
            {status === "none" ? t("Set up verification") : t("Verify page")}
          </Text>
        </Group>
      }
      size={520}
    >
      {status === "none" ? (
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

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;

  const { data: verificationInfo, isLoading } = usePageVerificationInfoQuery(
    hasVerificationFeature ? pageId : undefined,
  );
  const upgradeLabel = useUpgradeLabel();

  if (!pageId) return null;
  if (!hasVerificationFeature) {
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

  const status = verificationInfo?.status ?? "none";

  if (status === "none" && readOnly) return null;

  const tooltipLabel =
    status === "verified" && verificationInfo?.expiresAt
      ? t("Verified until {{date}}", {
          date: new Date(verificationInfo.expiresAt).toLocaleDateString(
            undefined,
            { month: "long", day: "numeric", year: "numeric" },
          ),
        })
      : getStatusLabel(status, t);

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

  const { data: verificationInfo } = usePageVerificationInfoQuery(
    hasVerificationFeature ? pageId : undefined,
  );

  const hasVerification =
    !!verificationInfo && verificationInfo.status !== "none";
  const label = hasVerification
    ? t("Edit verification")
    : t("Add verification");

  const menuItem = (
    <Menu.Item
      disabled={!hasVerificationFeature}
      leftSection={<IconShieldCheck size={16} />}
      onClick={hasVerificationFeature ? onClick : undefined}
    >
      {label}
    </Menu.Item>
  );

  if (!hasVerificationFeature) {
    return (
      <Tooltip label={upgradeLabel} position="left" withinPortal={false}>
        {menuItem}
      </Tooltip>
    );
  }

  return menuItem;
}
