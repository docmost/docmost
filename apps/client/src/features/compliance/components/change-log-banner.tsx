import { Alert, Button, Group, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useChangeLogInfoQuery } from "@/features/compliance/queries/change-set-query.ts";
import ChangeSetFormModal from "@/features/compliance/components/change-set-form-modal.tsx";

interface ChangeLogBannerProps {
  pageId: string;
  canEdit?: boolean;
}

export default function ChangeLogBanner({
  pageId,
  canEdit,
}: ChangeLogBannerProps) {
  const { t } = useTranslation();
  const { data } = useChangeLogInfoQuery({ pageId });
  const [opened, { open, close }] = useDisclosure(false);

  if (!data?.enabled || !data.undocumented) {
    return null;
  }

  return (
    <Alert
      color="red"
      variant="light"
      radius="sm"
      mb="md"
      icon={<IconAlertTriangle size={18} />}
      styles={{ wrapper: { alignItems: "center" } }}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
          {t(
            "This page was changed without a change log entry. Please document the change.",
          )}
        </Text>
        {canEdit && (
          <Button size="xs" variant="light" color="red" onClick={open}>
            {t("Document change")}
          </Button>
        )}
      </Group>

      <ChangeSetFormModal
        opened={opened}
        onClose={close}
        scope={{ pageId }}
      />
    </Alert>
  );
}
