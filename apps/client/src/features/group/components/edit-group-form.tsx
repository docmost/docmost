import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React, { useEffect } from "react";
import {
  useGroupQuery,
  useUpdateGroupMutation,
} from "@/features/group/queries/group-query.ts";
import { useForm } from "@mantine/form";
import { z } from "zod/v4";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { IGroup } from "@/features/group/types/group.types.ts";

const formSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500),
});

type FormValues = z.infer<typeof formSchema>;
interface EditGroupFormProps {
  onClose?: () => void;
  group?: IGroup;
}
export function EditGroupForm({ onClose, group: groupProp }: EditGroupFormProps) {
  const { t } = useTranslation();
  const updateGroupMutation = useUpdateGroupMutation();
  const { isSuccess } = updateGroupMutation;
  const { groupId: routeGroupId } = useParams();
  const groupId = groupProp?.id ?? routeGroupId;
  const { data: queriedGroup } = useGroupQuery(groupProp ? undefined : groupId);
  const group = groupProp ?? queriedGroup;

  useEffect(() => {
    if (isSuccess) {
      if (onClose) {
        onClose();
      }
    }
  }, [isSuccess]);

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
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
              data-autofocus
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
