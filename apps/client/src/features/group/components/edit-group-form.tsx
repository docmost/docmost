import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React, { useEffect } from "react";
import {
  useGroupQuery,
  useUpdateGroupMutation,
} from "@/features/group/queries/group-query.ts";
import { useForm, zodResolver } from "@mantine/form";
import * as z from "zod";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500),
});

type FormValues = z.infer<typeof formSchema>;
interface EditGroupFormProps {
  onClose?: () => void;
}
export function EditGroupForm({ onClose }: EditGroupFormProps) {
  const { t } = useTranslation();
  const updateGroupMutation = useUpdateGroupMutation();
  const { isSuccess } = updateGroupMutation;
  const { groupId } = useParams();
  const { data: group } = useGroupQuery(groupId);

  useEffect(() => {
    if (isSuccess) {
      if (onClose) {
        onClose();
      }
    }
  }, [isSuccess]);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: group?.name,
      description: group?.description,
    },
  });

  const handleSubmit = async (data: {
    name?: string;
    description?: string;
  }) => {
    const groupData = {
      groupId: groupId,
      name: data.name,
      description: data.description,
    };

    await updateGroupMutation.mutateAsync(groupData);
  };

  return (
    <>
      <Box maw="500" mx="auto">
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              withAsterisk
              id="name"
              label={t("Group name")}
              placeholder={t("e.g Developers")}
              variant="filled"
              {...form.getInputProps("name")}
            />

            <Textarea
              id="description"
              label={t("Group description")}
              placeholder={t("e.g Group for developers")}
              variant="filled"
              autosize
              minRows={2}
              maxRows={8}
              {...form.getInputProps("description")}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button type="submit">{t("Save")}</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}
