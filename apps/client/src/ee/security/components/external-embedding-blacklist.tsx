import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { updateWorkspace } from "@/features/workspace/services/workspace-service";
import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function ExternalEmbeddingBlacklist() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const blacklistValue = workspace?.settings?.externalEmbeddingBlacklist;
  const blockedUrls = useMemo<string[]>(() => {
    if (!blacklistValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(blacklistValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [blacklistValue]);

  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  const addUrl = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl || blockedUrls.includes(normalizedUrl)) {
      return;
    }

    setIsAdding(true);
    try {
      const updatedWorkspace = await updateWorkspace({
        addExternalEmbeddingBlacklistUrl: normalizedUrl,
      });
      setWorkspace(updatedWorkspace);
      setUrl("");
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || t("Failed to add blocked URL"),
        color: "red",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const removeUrl = async (urlToRemove: string) => {
    setRemovingUrl(urlToRemove);
    try {
      const updatedWorkspace = await updateWorkspace({
        removeExternalEmbeddingBlacklistUrl: urlToRemove,
      });
      setWorkspace(updatedWorkspace);
    } catch (err: any) {
      notifications.show({
        message:
          err?.response?.data?.message || t("Failed to remove blocked URL"),
        color: "red",
      });
    } finally {
      setRemovingUrl(null);
    }
  };

  return (
    <div>
      <Text size="md">{t("Block external embeds")}</Text>
      <Text size="sm" c="dimmed">
        {t(
          "Prevent content from these URLs from being displayed as page embeds."
        )}
      </Text>

      <Stack gap="sm" mt="sm">
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            flex={1}
            label={"URL"}
            placeholder={"https://example.com"}
            value={url}
            disabled={isAdding}
            onChange={(event) => setUrl(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addUrl();
              }
            }}
          />
          <Button onClick={addUrl} loading={isAdding} disabled={!url.trim()}>
            {t("Add URL")}
          </Button>
        </Group>

        {blockedUrls.length > 0 && (
          <ScrollArea.Autosize mah={500} type="auto">
            <Table withTableBorder withColumnBorders={false}>
              <Table.Tbody>
                {blockedUrls.map((blockedUrl) => (
                  <Table.Tr key={blockedUrl}>
                    <Table.Td>{blockedUrl}</Table.Td>
                    <Table.Td w={48}>
                      <Tooltip label={t("Remove URL")}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("Remove URL")}
                          onClick={() => removeUrl(blockedUrl)}
                          loading={removingUrl === blockedUrl}
                          disabled={isAdding || removingUrl !== null}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </div>
  );
}