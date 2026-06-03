import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useCreateChangeSetMutation } from "@/features/compliance/queries/change-set-query.ts";
import { IComplianceScope } from "@/features/compliance/types/compliance.types.ts";

const formSchema = z.object({
  reason: z.string().trim().min(1),
  requestedBy: z.string().trim().min(1),
  targetSystem: z.string().trim().min(1),
  ticketRef: z.string().trim().max(200).optional(),
  entries: z
    .array(
      z.object({
        summary: z.string().trim().min(1),
        detail: z.string().optional(),
      }),
    )
    .min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface ChangeSetFormModalProps {
  opened: boolean;
  onClose: () => void;
  scope: IComplianceScope;
  correctsId?: string;
}

export default function ChangeSetFormModal({
  opened,
  onClose,
  scope,
  correctsId,
}: ChangeSetFormModalProps) {
  const { t } = useTranslation();
  const createChangeSetMutation = useCreateChangeSetMutation();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      reason: "",
      requestedBy: "",
      targetSystem: "",
      ticketRef: "",
      entries: [{ summary: "", detail: "" }],
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    try {
      await createChangeSetMutation.mutateAsync({
        ...scope,
        correctsId,
        reason: values.reason,
        requestedBy: values.requestedBy,
        targetSystem: values.targetSystem,
        ticketRef: values.ticketRef?.trim() ? values.ticketRef.trim() : undefined,
        entries: values.entries.map((entry) => ({
          summary: entry.summary,
          detail: entry.detail?.trim() ? entry.detail.trim() : undefined,
        })),
      });
      notifications.show({ message: t("Change log entry saved") });
      handleClose();
    } catch {
      notifications.show({
        message: t("Failed to save change log entry"),
        color: "red",
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={620}
      title={
        correctsId
          ? t("Correct change log entry")
          : t("New change log entry")
      }
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          {form.values.entries.map((_, index) => (
            <Box key={index}>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {t("Change {{number}}", { number: index + 1 })}
                </Text>
                {form.values.entries.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t("Remove")}
                    onClick={() => form.removeListItem("entries", index)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
              <TextInput
                placeholder={t("What was changed")}
                {...form.getInputProps(`entries.${index}.summary`)}
              />
              <Textarea
                mt={6}
                autosize
                minRows={1}
                placeholder={t("Additional detail (optional)")}
                {...form.getInputProps(`entries.${index}.detail`)}
              />
            </Box>
          ))}

          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={16} />}
            onClick={() => form.insertListItem("entries", { summary: "", detail: "" })}
            style={{ alignSelf: "flex-start" }}
          >
            {t("Add change")}
          </Button>

          <Divider my="xs" />

          <Textarea
            label={t("Reason")}
            description={t("Why was this change made?")}
            withAsterisk
            autosize
            minRows={2}
            {...form.getInputProps("reason")}
          />
          <TextInput
            label={t("Requested by")}
            description={t("Who requested or authorized this change?")}
            withAsterisk
            {...form.getInputProps("requestedBy")}
          />
          <TextInput
            label={t("System")}
            description={t("Affected system, e.g. M365 Entra ID")}
            withAsterisk
            {...form.getInputProps("targetSystem")}
          />
          <TextInput
            label={t("Ticket reference")}
            placeholder={t("Optional")}
            {...form.getInputProps("ticketRef")}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={createChangeSetMutation.isPending}>
              {t("Save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
