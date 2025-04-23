import { Modal, Button, Group, Text, Select, Stack } from "@mantine/core";
import {
  createSynchronizedPage,
  getPagesInSpace,
} from "@/features/page/services/page-service.ts";
import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select.tsx";
import { useNavigate } from "react-router-dom";
import Page from "@/pages/page/page";
import { buildPageUrl } from "../page.utils";

interface CreateSyncPageModalProps {
  originPageId: string;
  currentSpaceSlug: string;
  open: boolean;
  onClose: () => void;
}

interface PageOption {
  value: string;
  label: string;
}

export default function CreateSyncPageModal({
  originPageId,
  currentSpaceSlug,
  open,
  onClose,
}: CreateSyncPageModalProps) {
  const { t } = useTranslation();
  const [targetSpace, setTargetSpace] = useState<ISpace>(null);
  const [targetPageId, setTargetPageId] = useState<string>("");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (targetSpace) {
      fetchPagesList();
    } else {
      setPages([]);
      setTargetPageId("");
    }
  }, [targetSpace]);

  const fetchPagesList = async () => {
    if (!targetSpace) return;

    setIsLoadingPages(true);

    const pagesData = await getPagesInSpace({
      spaceId: targetSpace.id,
    }).catch((error) => {
      notifications.show({
        message: error.response?.data.message || "Failed to fetch pages",
        color: "red",
      });
    });

    if (!pagesData) {
      setIsLoadingPages(false);
      return;
    }

    const pageOptions = pagesData.items.map((page) => ({
      value: page.id,
      label: page.title || "Untitled Page",
    }));

    setPages(pageOptions);
    setIsLoadingPages(false);
  };

  const handleNewSyncPage = async () => {
    if (!targetSpace) return;

    const createdPage = await createSynchronizedPage({
      spaceId: targetSpace.id,
      originPageId: originPageId,
      parentPageId: targetPageId,
    }).catch((err) => {
      notifications.show({
        message: err.response?.data.message || "An error occurred",
        color: "red",
      });
    });

    if (!createdPage) {
      notifications.show({
        message: "An error occurred",
        color: "red",
      });
      return;
    }

    const pageUrl = buildPageUrl(
      targetSpace.slug,
      createdPage.slugId,
      undefined,
    );
    navigate(pageUrl);

    notifications.show({
      message: t("Successfully created synced page"),
    });

    onClose();

    setTargetSpace(null);
    setTargetPageId("");
  };

  const handleSpaceChange = (space: ISpace) => {
    setTargetSpace(space);
  };

  const handlePageChange = (value: string) => {
    setTargetPageId(value);
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
          <Modal.Title fw={500}>{t("Create synchronized page")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <Text mb="xs" c="dimmed" size="sm">
            {t("Create a synchronized page in a different space.")}
          </Text>
          <Stack>
            <SpaceSelect
              value={currentSpaceSlug}
              clearable={false}
              onChange={handleSpaceChange}
              label={t("Select target space")}
            />

            <Select
              label={t("Select parent page (optional)")}
              placeholder={t("Choose a parent page")}
              data={pages}
              value={targetPageId}
              onChange={handlePageChange}
              clearable
              searchable
              disabled={!targetSpace}
              nothingFoundMessage={t("No page found")}
              onClick={(e) => e.stopPropagation()}
            />
          </Stack>

          <Group justify="end" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Button onClick={handleNewSyncPage} disabled={!targetSpace}>
              {t("Create")}
            </Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
