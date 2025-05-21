import { Modal, Button, Group, Text } from "@mantine/core";
import { movePageToSpace } from "@/features/page/services/page-service.ts";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { queryClient } from "@/main.tsx";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select.tsx";
import { useNavigate } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils.ts";

interface MovePageModalProps {
  pageId: string;
  slugId: string;
  currentSpaceSlug: string;
  open: boolean;
  onClose: () => void;
}

export default function MovePageModal({
  pageId,
  slugId,
  currentSpaceSlug,
  open,
  onClose,
}: MovePageModalProps) {
  const { t } = useTranslation();
  const [targetSpace, setTargetSpace] = useState<ISpace>(null);
  const navigate = useNavigate();

  const handlePageMove = async () => {
    if (!targetSpace) return;

    try {
      await movePageToSpace({ pageId, spaceId: targetSpace.id });
      queryClient.removeQueries({
        predicate: (item) =>
          ["pages", "sidebar-pages", "root-sidebar-pages"].includes(
            item.queryKey[0] as string,
          ),
      });

      const pageUrl = buildPageUrl(targetSpace.slug, slugId, undefined);
      navigate(pageUrl);
      notifications.show({
        message: t("Page moved successfully"),
      });
      onClose();
      setTargetSpace(null);
    } catch (err) {
      notifications.show({
        message: err.response?.data.message || "An error occurred",
        color: "red",
      });
      console.log(err);
    }
  };

  const handleChange = (space: ISpace) => {
    setTargetSpace(space);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t("Move page")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Text mb="xs" c="dimmed" size="sm">
            {t("Move page to a different space.")}
          </Text>

          <SpaceSelect
            value={currentSpaceSlug}
            clearable={false}
            onChange={handleChange}
          />
          <Group justify="end" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Button onClick={handlePageMove}>{t("Move")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
