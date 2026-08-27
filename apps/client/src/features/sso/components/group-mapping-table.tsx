import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDots, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import {
  useDeleteGroupMappingMutation,
  useGroupMappingsQuery,
  useResyncGroupsMutation,
  useSsoConfigQuery,
} from "@/features/sso/queries/sso-query.ts";
import { IGroupMapping } from "@/features/sso/types/sso.types.ts";
import { getUserRoleLabel } from "@/features/workspace/types/user-role-data.ts";
import NoTableResults from "@/components/common/no-table-results.tsx";

function SyncStatus({ mapping }: { mapping: IGroupMapping }) {
  const { t } = useTranslation();

  if (mapping.lastSyncStatus === "error") {
    return (
      <Tooltip label={mapping.lastSyncError} multiline maw={320}>
        <Badge variant="light" color="red">
          {t("Failed")}
        </Badge>
      </Tooltip>
    );
  }

  if (!mapping.lastSyncedAt) {
    return (
      <Badge variant="light" color="gray">
        {t("Never synced")}
      </Badge>
    );
  }

  return (
    <Text size="sm" c="dimmed">
      {formatDistanceToNow(new Date(mapping.lastSyncedAt), {
        addSuffix: true,
      })}
    </Text>
  );
}

export default function GroupMappingTable() {
  const { t } = useTranslation();
  const { data: mappings, isLoading } = useGroupMappingsQuery();
  const { data: config } = useSsoConfigQuery();
  const deleteMutation = useDeleteGroupMappingMutation();
  const resyncMutation = useResyncGroupsMutation();

  const openDeleteModal = (mapping: IGroupMapping) =>
    modals.openConfirmModal({
      title: t("Remove mapping"),
      children: (
        <Text size="sm">
          {t(
            "Members that this mapping added will be removed from the group. Members added manually are kept.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutateAsync({ mappingId: mapping.id }),
    });

  if (isLoading) return null;

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Text fw={500}>{t("Group mappings")}</Text>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconRefresh size={14} />}
          disabled={!config?.groupSyncConfigured || !mappings?.length}
          loading={resyncMutation.isPending}
          onClick={() => resyncMutation.mutate({})}
        >
          {t("Resync now")}
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Google group")}</Table.Th>
              <Table.Th>{t("Docmost group")}</Table.Th>
              <Table.Th>{t("Role")}</Table.Th>
              <Table.Th>{t("Last sync")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {mappings?.length > 0 ? (
              mappings.map((mapping) => (
                <Table.Tr key={mapping.id}>
                  <Table.Td>
                    <Text size="sm">{mapping.externalGroupKey}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{mapping.groupName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={mapping.role ? undefined : "dimmed"}>
                      {mapping.role
                        ? t(getUserRoleLabel(mapping.role))
                        : t("No change")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SyncStatus mapping={mapping} />
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" c="gray">
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconRefresh size={14} />}
                          disabled={!config?.groupSyncConfigured}
                          onClick={() =>
                            resyncMutation.mutate({ mappingId: mapping.id })
                          }
                        >
                          {t("Resync this group")}
                        </Menu.Item>
                        <Menu.Item
                          c="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => openDeleteModal(mapping)}
                        >
                          {t("Remove")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <NoTableResults colSpan={5} />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  );
}
