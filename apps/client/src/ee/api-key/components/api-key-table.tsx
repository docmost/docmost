import { ActionIcon, Group, Menu, Table, Text } from "@mantine/core";
import { IconDots, IconEdit, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { IApiKey } from "@/ee/api-key";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import React from "react";
import NoTableResults from "@/components/common/no-table-results";

interface ApiKeyTableProps {
  apiKeys: IApiKey[];
  isLoading?: boolean;
  showUserColumn?: boolean;
  onUpdate?: (apiKey: IApiKey) => void;
  onRevoke?: (apiKey: IApiKey) => void;
}

export function ApiKeyTable({
  apiKeys,
  isLoading,
  showUserColumn = false,
  onUpdate,
  onRevoke,
}: ApiKeyTableProps) {
  const { t } = useTranslation();

  const formatDate = (date: Date | string | null) => {
    if (!date) return t("Never");
    return format(new Date(date), "MMM dd, yyyy");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Table.ScrollContainer minWidth={500}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("Name")}</Table.Th>
            {showUserColumn && <Table.Th>{t("User")}</Table.Th>}
            <Table.Th>{t("Last used")}</Table.Th>
            <Table.Th>{t("Expires")}</Table.Th>
            <Table.Th>{t("Created")}</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {apiKeys && apiKeys.length > 0 ? (
            apiKeys.map((apiKey: IApiKey, index: number) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text fz="sm" fw={500}>
                    {apiKey.name}
                  </Text>
                </Table.Td>

                {showUserColumn && apiKey.creator && (
                  <Table.Td>
                    <Group gap="4" wrap="nowrap">
                      <CustomAvatar
                        avatarUrl={apiKey.creator?.avatarUrl}
                        name={apiKey.creator.name}
                        size="sm"
                      />
                      <Text fz="sm" lineClamp={1}>
                        {apiKey.creator.name}
                      </Text>
                    </Group>
                  </Table.Td>
                )}

                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {formatDate(apiKey.lastUsedAt)}
                  </Text>
                </Table.Td>

                <Table.Td>
                  {apiKey.expiresAt ? (
                    isExpired(apiKey.expiresAt) ? (
                      <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                        {t("Expired")}
                      </Text>
                    ) : (
                      <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(apiKey.expiresAt)}
                      </Text>
                    )
                  ) : (
                    <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                      {t("Never")}
                    </Text>
                  )}
                </Table.Td>

                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {formatDate(apiKey.createdAt)}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {onUpdate && (
                        <Menu.Item
                          leftSection={<IconEdit size={16} />}
                          onClick={() => onUpdate(apiKey)}
                        >
                          {t("Rename")}
                        </Menu.Item>
                      )}
                      {onRevoke && (
                        <Menu.Item
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={() => onRevoke(apiKey)}
                        >
                          {t("Revoke")}
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <NoTableResults colSpan={showUserColumn ? 6 : 5} />
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
