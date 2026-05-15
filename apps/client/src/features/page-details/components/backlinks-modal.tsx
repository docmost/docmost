import { Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useBacklinksCountQuery } from "@/features/page-details/queries/backlinks-query.ts";
import { BacklinksList } from "./backlinks-list";

interface BacklinksModalProps {
  pageId: string;
  opened: boolean;
  onClose: () => void;
}

export function BacklinksModal({
  pageId,
  opened,
  onClose,
}: BacklinksModalProps) {
  const { t } = useTranslation();
  const { data: counts } = useBacklinksCountQuery(pageId);

  return (
    <Modal.Root opened={opened} onClose={onClose} size={640} yOffset="10vh">
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <Modal.Title fw={500}>{t("Backlinks")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">
                {t("Incoming links ({{count}})", {
                  count: counts?.incoming ?? 0,
                })}
              </Text>
              <BacklinksList
                pageId={pageId}
                direction="incoming"
                enabled={opened}
                onItemClick={onClose}
              />
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">
                {t("Outgoing links ({{count}})", {
                  count: counts?.outgoing ?? 0,
                })}
              </Text>
              <BacklinksList
                pageId={pageId}
                direction="outgoing"
                enabled={opened}
                onItemClick={onClose}
              />
            </Stack>
          </Stack>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
