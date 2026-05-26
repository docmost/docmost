import { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Group,
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

function detectRefType(url: string): RefType {
  if (/github\.com\/.+\/pull\/\d+/.test(url)) return "PR";
  if (/github\.com\/.+\/commit\/[a-f0-9]+/.test(url)) return "COMMIT";
  if (/jira\.|atlassian\.net|linear\.app/.test(url)) return "TICKET";
  return "BUILD";
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
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
    if (!isValidUrl(url)) return;
    addMutation.mutate(
      { changeRequestId: cr.id, refType: detectRefType(url), url },
      { onSuccess: () => setUrl("") },
    );
  };

  return (
    <Stack gap="sm">
      {refs.length === 0 && (
        <Text size="sm" c="dimmed">
          {t("No external references yet")}
        </Text>
      )}

      {refs.map((ref) => (
        <Group key={ref.id} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ overflow: "hidden" }}>
            <Badge color={REF_COLORS[ref.ref_type]} size="xs" variant="light">
              {ref.ref_type}
            </Badge>
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
          <ActionIcon
            size="input-sm"
            variant="filled"
            disabled={!url || !isValidUrl(url)}
            loading={addMutation.isPending}
            onClick={handleAdd}
            aria-label={t("Add reference")}
          >
            <IconLink size={16} />
          </ActionIcon>
        </Group>
      )}
    </Stack>
  );
}
