import { Center, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import { usePageVerificationInfoQuery } from "@/ee/page-verification/queries/page-verification-query";
import { RemoveVerificationForm } from "./remove-verification-modal";

type LimitedVerificationFormProps = {
  pageId: string;
  onClose: () => void;
};

// Without the licence only removing approval is left, so a lapsed workspace can still get its content out.
export function LimitedVerificationForm({
  pageId,
  onClose,
}: LimitedVerificationFormProps) {
  const { t } = useTranslation();
  const upgradeLabel = useUpgradeLabel();
  const { data: info } = usePageVerificationInfoQuery(pageId);

  if (!info) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Stack>
      <div>
        <Text size="sm" c="dimmed">
          {t("Approval needs a paid plan. You can still remove it from this page.")}
        </Text>
        <Text size="sm" c="dimmed">
          {upgradeLabel}
        </Text>
      </div>

      {info.permissions?.canRemove && (
        <RemoveVerificationForm
          pageId={pageId}
          onCancel={onClose}
          onRemoved={onClose}
          hasDraftChanges={info.hasDraftChanges === true}
          canDiscard={!!info.latestReaderVersion}
        />
      )}
    </Stack>
  );
}
