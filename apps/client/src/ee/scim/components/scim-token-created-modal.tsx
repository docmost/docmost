import {
  Modal,
  Text,
  Stack,
  Alert,
  Group,
  Button,
  TextInput,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy.tsx";
import { IScimToken } from "@/ee/scim/types/scim-token.types";

interface ScimTokenCreatedModalProps {
  opened: boolean;
  onClose: () => void;
  scimToken: IScimToken | null;
}

export function ScimTokenCreatedModal({
  opened,
  onClose,
  scimToken,
}: ScimTokenCreatedModalProps) {
  const { t } = useTranslation();
  if (!scimToken) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={t("SCIM token created")} size="lg">
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title={t("Important")}
          color="red"
        >
          {t(
            "Make sure to copy your SCIM token now. You won't be able to see it again!",
          )}
        </Alert>

        <div>
          <Text size="sm" fw={500} mb="xs">
            {t("SCIM token")}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              variant="filled"
              style={{ flex: 1 }}
              value={scimToken.token}
              readOnly
            />
            <CopyTextButton text={scimToken.token} />
          </Group>
        </div>

        <Button fullWidth onClick={onClose} mt="md">
          {t("I've saved my SCIM token")}
        </Button>
      </Stack>
    </Modal>
  );
}
