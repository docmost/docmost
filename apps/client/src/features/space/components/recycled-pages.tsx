import {
  useDeletedPagesQuery,
  useRestorePageMutation,
  useDeletePageMutation,
} from "@/features/page/queries/page-query.ts";
import { modals } from "@mantine/modals";
import { ActionIcon, Menu, Table, Text } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";

interface RecycledPagesProps {
  spaceId: string;
  readOnly?: boolean;
}

export default function RecycledPagesList({
  spaceId,
  readOnly,
}: RecycledPagesProps) {
  const { data, isLoading } = useDeletedPagesQuery(spaceId);
  const restorePageMutation = useRestorePageMutation();
  const removePageMutation = useDeletePageMutation();

  const handleRestorePage = async (pageId: string) => {
    await restorePageMutation.mutateAsync(pageId);
  };

  const handleRemovePage = async (pageId: string) => {
    await removePageMutation.mutateAsync(pageId);
  };

  const openRemovePageModal = (pageId: string) =>
    modals.openConfirmModal({
      title: "Delete page permanently",
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete this page ?
        </Text>
      ),
      centered: true,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => handleRemovePage(pageId),
    });

  const openRestorePageModal = (pageId: string) =>
    modals.openConfirmModal({
      title: "Restore page",
      children: <Text size="sm">Restore this page ?</Text>,
      centered: true,
      labels: { confirm: "Restore", cancel: "Cancel" },
      confirmProps: { color: "blue" },
      onConfirm: () => handleRestorePage(pageId),
    });

  return (
    <>
      {data && data.items.length > 0 ? (
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Deleted Pages</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((page) => (
              <Table.Tr key={page.id}>
                <Table.Td>
                  <Text component="div" fz="sm" fw={500}>
                    {page?.title || "Untitled"}
                  </Text>
                </Table.Td>

                <Table.Td>
                  {!readOnly && (
                    <Menu>
                      <Menu.Target>
                        <ActionIcon variant="subtle" c="gray">
                          <IconDots size={20} stroke={2} />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={() => openRestorePageModal(page.id)}
                        >
                          Restore Page
                        </Menu.Item>
                        <Menu.Item onClick={() => openRemovePageModal(page.id)}>
                          Delete Page permanently
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No deleted pages
        </Text>
      )}
    </>
  );
}
