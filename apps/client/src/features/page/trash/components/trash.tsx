import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import {
  Container,
  Title,
  Table,
  Group,
  ActionIcon,
  Text,
  Alert,
  Stack,
  Menu,
} from "@mantine/core";
import {
  IconInfoCircle,
  IconDots,
  IconRestore,
  IconTrash,
  IconFileDescription,
} from "@tabler/icons-react";
import {
  useDeletedPagesQuery,
  useRestorePageMutation,
  useDeletePageMutation,
} from "@/features/page/queries/page-query";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time";
import { useState } from "react";
import TrashPageContentModal from "@/features/page/trash/components/trash-page-content-modal";
import { UserInfo } from "@/components/common/user-info.tsx";
import Paginate from "@/components/common/paginate.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";

export default function Trash() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { page, setPage } = usePaginateAndSearch();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const { data: deletedPages, isLoading } = useDeletedPagesQuery(space?.id, {
    page, limit: 50
  });
  const restorePageMutation = useRestorePageMutation();
  const deletePageMutation = useDeletePageMutation();

  const [selectedPage, setSelectedPage] = useState<{
    title: string;
    content: any;
  } | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const handleRestorePage = async (pageId: string) => {
    await restorePageMutation.mutateAsync(pageId);
  };

  const handleDeletePage = async (pageId: string) => {
    await deletePageMutation.mutateAsync(pageId);
  };

  const openDeleteModal = (pageId: string, pageTitle: string) => {
    modals.openConfirmModal({
      title: t("Are you sure you want to delete this page?"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to permanently delete '{{title}}'? This action cannot be undone.",
            { title: pageTitle || "Untitled" },
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => handleDeletePage(pageId),
    });
  };

  const openRestoreModal = (pageId: string, pageTitle: string) => {
    modals.openConfirmModal({
      title: t("Restore page"),
      children: (
        <Text size="sm">
          {t("Restore '{{title}}' and its sub-pages?", {
            title: pageTitle || "Untitled",
          })}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Restore"), cancel: t("Cancel") },
      confirmProps: { color: "blue" },
      onConfirm: () => handleRestorePage(pageId),
    });
  };

  const hasPages = deletedPages && deletedPages.items.length > 0;

  const handlePageClick = (page: any) => {
    setSelectedPage({ title: page.title, content: page.content });
    setModalOpened(true);
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between" mb="md">
          <Title order={2}>{t("Trash")}</Title>
        </Group>

        <Alert icon={<IconInfoCircle size={16} />} variant="light" color="red">
          <Text size="sm">
            {t("Pages in trash will be permanently deleted after 30 days.")}
          </Text>
        </Alert>

        {isLoading || !deletedPages ? (
          <></>
        ) : hasPages ? (
          <Table.ScrollContainer minWidth={500}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("Page")}</Table.Th>
                  <Table.Th style={{ whiteSpace: "nowrap" }}>
                    {t("Deleted by")}
                  </Table.Th>
                  <Table.Th style={{ whiteSpace: "nowrap" }}>
                    {t("Deleted at")}
                  </Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {deletedPages.items.map((page) => (
                  <Table.Tr key={page.id}>
                    <Table.Td>
                      <Group
                        wrap="nowrap"
                        style={{ cursor: "pointer" }}
                        onClick={() => handlePageClick(page)}
                      >
                        {page.icon || (
                          <ActionIcon
                            variant="transparent"
                            color="gray"
                            size={18}
                          >
                            <IconFileDescription size={18} />
                          </ActionIcon>
                        )}
                        <div>
                          <Text fw={500} size="sm" lineClamp={1}>
                            {page.title || t("Untitled")}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <UserInfo user={page.deletedBy} size="sm" />
                    </Table.Td>
                    <Table.Td>
                      <Text
                        c="dimmed"
                        style={{ whiteSpace: "nowrap" }}
                        size="xs"
                        fw={500}
                      >
                        {formattedDate(page.deletedAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDots size={20} stroke={1.5} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconRestore size={16} />}
                            onClick={() =>
                              openRestoreModal(page.id, page.title)
                            }
                          >
                            {t("Restore")}
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => openDeleteModal(page.id, page.title)}
                          >
                            {t("Delete")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text ta="center" py="xl" c="dimmed">
            {t("No pages in trash")}
          </Text>
        )}

        {deletedPages && deletedPages.items.length > 0 && (
          <Paginate
            currentPage={page}
            hasPrevPage={deletedPages.meta.hasPrevPage}
            hasNextPage={deletedPages.meta.hasNextPage}
            onPageChange={setPage}
          />
        )}
      </Stack>

      {selectedPage && (
        <TrashPageContentModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          pageTitle={selectedPage.title}
          pageContent={selectedPage.content}
        />
      )}
    </Container>
  );
}
