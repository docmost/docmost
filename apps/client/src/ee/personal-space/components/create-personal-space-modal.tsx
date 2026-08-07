import { Modal, TextInput, Button, Group, Divider } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useCreatePersonalSpaceMutation } from "@/ee/personal-space/queries/personal-space-query";
import { getSpaceUrl } from "@/lib/config.ts";
import { notifications } from "@mantine/notifications";

const formSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
type FormValues = z.infer<typeof formSchema>;

type Props = {
  opened: boolean;
  onClose: () => void;
};

export default function CreatePersonalSpaceModal({ opened, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAtomValue(currentUserAtom);
  const createMutation = useCreatePersonalSpaceMutation();

  const firstName = (currentUser?.user?.name ?? "").trim().split(/\s+/)[0] || "";

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      name: firstName ? t("{{name}}'s space", { name: firstName }) : "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      const createdSpace = await createMutation.mutateAsync({
        name: values.name,
      });
      onClose();
      navigate(getSpaceUrl(createdSpace.slug));
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Create personal space")}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <Divider size="xs" mb="md" />
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput
          withAsterisk
          data-autofocus
          label={t("Space name")}
          variant="filled"
          errorProps={{ role: "alert" }}
          {...form.getInputProps("name")}
        />
        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={createMutation.isPending}>
            {t("Create")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
