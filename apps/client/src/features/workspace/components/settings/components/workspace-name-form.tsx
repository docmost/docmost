import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useAtom } from "jotai";
import * as z from "zod";
import { useState } from "react";
import { focusAtom } from "jotai-optics";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import { TextInput, Button } from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(4).nonempty("Workspace name cannot be blank"),
});

type FormValues = z.infer<typeof formSchema>;

const workspaceAtom = focusAtom(currentUserAtom, (optic) =>
  optic.prop("workspace"),
);

export default function WorkspaceNameForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setWorkspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: currentUser?.workspace?.name,
    },
  });

  async function handleSubmit(data: Partial<IWorkspace>) {
    setIsLoading(true);

    try {
      const updatedWorkspace = await updateWorkspace(data);
      setWorkspace(updatedWorkspace);
      notifications.show({ message: t("Updated successfully") });
    } catch (err) {
      console.log(err);
      notifications.show({
        message: t("Failed to update data"),
        color: "red",
      });
    }
    setIsLoading(false);
    form.resetDirty();
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        id="name"
        label={t("Name")}
        placeholder={t("e.g ACME")}
        variant="filled"
        readOnly={!isAdmin}
        {...form.getInputProps("name")}
      />

      {isAdmin && (
        <Button
          mt="sm"
          type="submit"
          disabled={isLoading || !form.isDirty()}
          loading={isLoading}
        >
          {t("Save")}
        </Button>
      )}
    </form>
  );
}
