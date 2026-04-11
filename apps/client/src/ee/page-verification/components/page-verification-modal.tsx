import {
  ActionIcon,
  Group,
  Menu,
  Modal,
  Text,
  Tooltip,
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
  const isCloudEE = useHasFeature(Feature.PAGE_VERIFICATION);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;

  const { data: verificationInfo, isLoading } = usePageVerificationInfoQuery(
    isCloudEE ? pageId : undefined,
  );

  if (!isCloudEE || !pageId) return null;
  if (isLoading) return null;

  const status = verificationInfo?.status ?? "none";

  if (status === "none" && readOnly) return null;

  return (
    <>
      {status !== "none" ? (
        <Tooltip label={getStatusLabel(status, t)} withArrow openDelay={250}>
          <Group
            gap={4}
            onClick={open}
            style={{ cursor: "pointer" }}
            wrap="nowrap"
          >
            <IconRosetteDiscountCheckFilled
              size={18}
              color={`var(--mantine-color-${getStatusColor(status).replace(".", "-")})`}
            />
            <Text size="sm" c={getStatusColor(status)}>
              {getStatusLabel(status, t)}
            </Text>
          </Group>
        </Tooltip>
      ) : !readOnly ? (
        <Tooltip label={t("Set up verification")} withArrow openDelay={250}>
          <ActionIcon variant="subtle" color="gray" onClick={open}>
            <IconShieldCheck size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      <PageVerificationModal
        pageId={pageId}
        opened={opened}
        onClose={close}
      />
    </>
  );
}

type PageVerificationMenuItemProps = {
  onClick: () => void;
};

export function PageVerificationMenuItem({
  onClick,
}: PageVerificationMenuItemProps) {
  const { t } = useTranslation();
  const isCloudEE = useHasFeature(Feature.PAGE_VERIFICATION);

  if (!isCloudEE) return null;

  return (
    <Menu.Item leftSection={<IconShieldCheck size={16} />} onClick={onClick}>
      {t("Page verification")}
    </Menu.Item>
  );
}
