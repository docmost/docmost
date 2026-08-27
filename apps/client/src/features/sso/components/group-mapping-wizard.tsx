import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Stepper,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle, IconWand } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useGetGroupsQuery } from "@/features/group/queries/group-query.ts";
import { IGroup } from "@/features/group/types/group.types.ts";
import { userRoleData } from "@/features/workspace/types/user-role-data.ts";
import { UserRole } from "@/lib/types.ts";
import { previewMapping } from "@/features/sso/services/sso-service.ts";
import {
  useCommitWizardMutation,
  useSsoConfigQuery,
} from "@/features/sso/queries/sso-query.ts";
import { IMappingPreview } from "@/features/sso/types/sso.types.ts";

interface DraftRow {
  groupId: string;
  groupName: string;
  externalGroupKey: string;
  role: string | null;
  preview?: IMappingPreview;
  previewError?: string;
}

export default function GroupMappingWizard() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [runSync, setRunSync] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { data: groups } = useGetGroupsQuery({ limit: 100 });
  const { data: config } = useSsoConfigQuery();
  const commitMutation = useCommitWizardMutation();

  const assignableRoles = userRoleData.filter(
    (role) => role.value !== UserRole.OWNER,
  );

  const handleOpen = () => {
    const editable = (groups?.items ?? []).filter(
      (group: IGroup) => !group.isDefault,
    );
    setRows(
      editable.map((group: IGroup) => ({
        groupId: group.id,
        groupName: group.name,
        externalGroupKey: "",
        role: null,
      })),
    );
    setActive(0);
    setRunSync(true);
    open();
  };

  const handleClose = () => {
    close();
    setTimeout(() => {
      setActive(0);
      setRows([]);
      setIsPreviewing(false);
    }, 200);
  };

  const filledRows = rows.filter((r) => r.externalGroupKey.trim().length > 0);

  const updateRow = (groupId: string, patch: Partial<DraftRow>) =>
    setRows((prev) =>
      prev.map((row) => (row.groupId === groupId ? { ...row, ...patch } : row)),
    );

  /** Ask the server what each mapping would do before anything is written. */
  const handlePreview = async () => {
    if (filledRows.length === 0) {
      notifications.show({
        message: t("Enter at least one Google group email."),
        color: "red",
      });
      return;
    }

    setIsPreviewing(true);
    const results = await Promise.all(
      filledRows.map(async (row) => {
        try {
          const preview = await previewMapping({
            externalGroupKey: row.externalGroupKey.trim(),
            groupId: row.groupId,
          });
          return { groupId: row.groupId, preview, previewError: undefined };
        } catch (error) {
          return {
            groupId: row.groupId,
            preview: undefined,
            previewError:
              error?.["response"]?.data?.message ||
              t("Could not read this Google group."),
          };
        }
      }),
    );

    setRows((prev) =>
      prev.map((row) => {
        const match = results.find((r) => r.groupId === row.groupId);
        return match ? { ...row, ...match } : row;
      }),
    );
    setIsPreviewing(false);
    setActive(1);
  };

  const handleCommit = async () => {
    // Rows whose preview failed are left out rather than silently mapped.
    const valid = filledRows.filter((row) => !row.previewError);

    await commitMutation.mutateAsync({
      mappings: valid.map((row) => ({
        externalGroupKey: row.externalGroupKey.trim(),
        groupId: row.groupId,
        role: row.role ?? undefined,
      })),
      runSync,
    });
    handleClose();
  };

  return (
    <>
      <Button
        variant="default"
        size="xs"
        leftSection={<IconWand size={14} />}
        onClick={handleOpen}
        disabled={!config?.groupSyncConfigured}
      >
        {t("Set up group mappings")}
      </Button>

      <Modal
        opened={opened}
        onClose={handleClose}
        title={t("Map Google groups to your groups")}
        size="xl"
      >
        <Stepper active={active} size="sm">
          <Stepper.Step
            label={t("Match groups")}
            description={t("Pick a Google group for each")}
          >
            <Text size="sm" c="dimmed" mt="md" mb="sm">
              {t(
                "Leave a row blank to skip it. Existing members you added by hand are never removed.",
              )}
            </Text>

            <ScrollArea.Autosize mah={360}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("Docmost group")}</Table.Th>
                    <Table.Th>{t("Google group email")}</Table.Th>
                    <Table.Th w={160}>{t("Role")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => (
                    <Table.Tr key={row.groupId}>
                      <Table.Td>
                        <Text size="sm">{row.groupName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          placeholder="team@example.com"
                          value={row.externalGroupKey}
                          onChange={(event) =>
                            updateRow(row.groupId, {
                              externalGroupKey: event.currentTarget.value,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          placeholder={t("No change")}
                          clearable
                          data={assignableRoles.map((role) => ({
                            value: role.value,
                            label: t(role.label),
                          }))}
                          value={row.role}
                          onChange={(value) =>
                            updateRow(row.groupId, { role: value })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={handleClose}>
                {t("Cancel")}
              </Button>
              <Button onClick={handlePreview} loading={isPreviewing}>
                {t("Preview changes")}
              </Button>
            </Group>
          </Stepper.Step>

          <Stepper.Step
            label={t("Review")}
            description={t("Confirm what will change")}
          >
            <Stack gap="xs" mt="md">
              {filledRows.map((row) => (
                <Alert
                  key={row.groupId}
                  variant="light"
                  color={row.previewError ? "red" : "blue"}
                  icon={<IconInfoCircle />}
                  title={`${row.externalGroupKey} → ${row.groupName}`}
                >
                  {row.previewError ? (
                    <Text size="sm">{row.previewError}</Text>
                  ) : (
                    <Text size="sm">
                      {t("{{add}} to add, {{existing}} already members.", {
                        add: row.preview?.wouldAdd ?? 0,
                        existing: row.preview?.alreadyMembers ?? 0,
                      })}{" "}
                      {t("{{manual}} manual members are unaffected.", {
                        manual: row.preview?.manualMembersUnaffected ?? 0,
                      })}{" "}
                      {t(
                        "{{missing}} Google members have no Docmost account and will be synced when they first sign in.",
                        { missing: row.preview?.withoutDocmostAccount ?? 0 },
                      )}
                    </Text>
                  )}
                </Alert>
              ))}

              <Switch
                mt="sm"
                label={t("Run a full sync after saving")}
                checked={runSync}
                onChange={(event) => setRunSync(event.currentTarget.checked)}
              />
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setActive(0)}>
                {t("Back")}
              </Button>
              <Button
                onClick={handleCommit}
                loading={commitMutation.isPending}
                disabled={filledRows.every((row) => row.previewError)}
              >
                {t("Save mappings")}
              </Button>
            </Group>
          </Stepper.Step>
        </Stepper>
      </Modal>
    </>
  );
}
