import { Alert, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

export function TrashBanner() {
  const { t } = useTranslation();
  const workspace = useAtomValue(workspaceAtom);
  const retentionDays = workspace?.trashRetentionDays ?? 30;

  return (
    <Alert icon={<IconInfoCircle size={16} />} variant="light" color="red">
      <Text size="sm" lh={1.35}>
        {t("Pages in trash will be permanently deleted after {{count}} days.", {
          count: retentionDays,
        })}
      </Text>
    </Alert>
  );
}
