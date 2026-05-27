import { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  List,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconLink, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAddExternalRefMutation, useRemoveExternalRefMutation } from "../hooks/useChangeRequests";
import type { ChangeRequest, ExternalRef, RefType } from "../types/cr.types";

const REF_COLORS: Record<RefType, string> = {
  PR: "violet",
  COMMIT: "blue",
  TICKET: "orange",
  BUILD: "gray",
};

function detectRefType(value: string): RefType {
  if (/github\.com\/.+\/pull\/\d+/.test(value)) return "PR";
  if (/github\.com\/.+\/commit\/[a-f0-9]+/.test(value)) return "COMMIT";
  if (/^[a-f0-9]{7,40}$/i.test(value)) return "COMMIT";
  if (/jira\.|atlassian\.net|linear\.app/.test(value)) return "TICKET";
  return "BUILD";
}

function isValidInput(value: string): boolean {
  if (/^[a-f0-9]{7,40}$/i.test(value)) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

interface CRExternalRefsListProps {
  cr: ChangeRequest;
  canEdit: boolean;
}

export function CRExternalRefsList({ cr, canEdit }: CRExternalRefsListProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const addMutation = useAddExternalRefMutation(cr.id);
  const removeMutation = useRemoveExternalRefMutation(cr.id);

  const refs: ExternalRef[] = cr.externalRefs ?? [];
  const detectedType = url ? detectRefType(url) : null;

  const handleAdd = () => {
    if (!isValidInput(url)) return;
    addMutation.mutate(
      { changeRequestId: cr.id, refType: detectRefType(url), url },
      { onSuccess: () => setUrl("") },
    );
  };

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {t("Supported reference types:")}
        </Text>
        <List size="xs" spacing={2} c="dimmed">
          <List.Item>
            <Badge color="violet" size="xs" variant="light" mr={4}>PR</Badge>
            {t("Pull request — e.g. github.com/.../pull/123")}
          </List.Item>
          <List.Item>
            <Badge color="blue" size="xs" variant="light" mr={4}>COMMIT</Badge>
            {t("Commit hash or link — e.g. a1b2c3d or github.com/.../commit/...")}
          </List.Item>
          <List.Item>
            <Badge color="orange" size="xs" variant="light" mr={4}>TICKET</Badge>
            {t("Ticket link — Jira, Linear, etc.")}
          </List.Item>
          <List.Item>
            <Badge color="gray" size="xs" variant="light" mr={4}>BUILD</Badge>
            {t("CI/CD pipeline or build artifact link")}
          </List.Item>
        </List>
      </Stack>
      <Divider />
      {refs.length === 0 && (
        <Text size="sm" c="dimmed">
          {t("No external references yet")}
        </Text>
      )}

      {refs.map((ref) => (
        <Group key={ref.id} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden" }}>
            <Badge color={REF_COLORS[ref.refType]} size="xs" variant="light">
              {ref.refType}
            </Badge>
            {isValidInput(ref.url) && !/^[a-f0-9]{7,40}$/i.test(ref.url) ? (
              <Anchor
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                truncate
                style={{ maxWidth: 360 }}
              >
                {ref.label ?? ref.url}
              </Anchor>
            ) : (
              <Text size="sm" truncate style={{ maxWidth: 360 }}>
                {ref.label ?? ref.url}
              </Text>
            )}
          </Group>
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              loading={removeMutation.isPending}
              onClick={() => removeMutation.mutate(ref.id)}
              aria-label={t("Remove reference")}
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      ))}

      {canEdit && (
        <Group gap="xs" align="flex-end">
          <TextInput
            flex={1}
            placeholder={t("Paste URL here...")}
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            rightSection={
              detectedType ? (
                <Badge color={REF_COLORS[detectedType]} size="xs" variant="light" mr="xs">
                  {detectedType}
                </Badge>
              ) : undefined
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            aria-label={t("External reference URL")}
          />
          <Button
            size="sm"
            variant="filled"
            disabled={!url || !isValidInput(url)}
            loading={addMutation.isPending}
            onClick={handleAdd}
            leftSection={<IconLink size={16} />}
          >
            {t("Inserisci")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
