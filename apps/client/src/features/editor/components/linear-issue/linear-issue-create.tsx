import { useEffect, useState } from "react";
import { Button, Group, Paper, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useLinearTeamsQuery } from "@/features/linear/queries/linear-query";
import { createLinearIssue } from "@/features/linear/services/linear-service";
import { ILinearIssue } from "@/features/linear/types/linear.types";
import LinearConnectPrompt from "./linear-connect-prompt";
import classes from "./linear-issue.module.css";

interface Props {
  initialTitle: string;
  onCreate: (issue: ILinearIssue) => void;
  onClose: () => void;
}

export default function LinearIssueCreate({
  initialTitle,
  onCreate,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data, isLoading } = useLinearTeamsQuery(true);

  const teams = data?.teams ?? [];
  const notConnected = data && data.connected === false;

  useEffect(() => {
    if (!teamId && teams.length > 0) setTeamId(teams[0].id);
  }, [teams, teamId]);

  const handleCreate = async () => {
    if (!teamId || !title.trim()) return;
    const showError = () =>
      notifications.show({
        message: t("Could not create the Linear issue."),
        color: "red",
      });
    setSubmitting(true);
    try {
      const result = await createLinearIssue({ teamId, title: title.trim() });
      if (result.issue) {
        onCreate(result.issue);
      } else {
        showError();
      }
    } catch {
      showError();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper shadow="md" withBorder className={classes.createPanel} p="sm">
      {notConnected ? (
        <LinearConnectPrompt action="create" />
      ) : (
        <Stack gap="xs">
          <TextInput
            label={t("Title")}
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
          />
          <Select
            label={t("Team")}
            data={teams.map((team) => ({
              value: team.id,
              label: `${team.key} · ${team.name}`,
            }))}
            value={teamId}
            onChange={setTeamId}
            disabled={isLoading}
            searchable
            comboboxProps={{ withinPortal: false }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              size="xs"
              loading={submitting}
              disabled={!teamId || !title.trim()}
              onClick={handleCreate}
            >
              {t("Create issue")}
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}
