import { useAtom } from "jotai";
import * as z from "zod";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import React, { useState } from "react";
import { Button, Text, TagsInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";

const formSchema = z.object({
  emailDomains: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;
export default function AllowedDomains() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, setDomains] = useState<string[]>([]);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      emailDomains: workspace?.emailDomains || [],
    },
  });

  async function handleSubmit(data: Partial<IWorkspace>) {
    setIsLoading(true);
    try {
      const updatedWorkspace = await updateWorkspace({
        emailDomains: data.emailDomains,
      });
      setWorkspace(updatedWorkspace);

      notifications.show({
        message: t("Updated successfully"),
      });
    } catch (err) {
      console.log(err);
      notifications.show({
        message: err.response.data.message,
        color: "red",
      });
    }

    form.resetDirty();

    setIsLoading(false);
  }

  return (
    <>
      <div>
        <Text size="md">{t("Allowed email domains")}</Text>
        <Text size="sm" c="dimmed">
          {t(
            "Only users with email addresses from these domains can signup via SSO.",
          )}
        </Text>
      </div>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TagsInput
          mt="sm"
          description={t(
            "Enter valid domain names separated by comma or space",
          )}
          placeholder={t("e.g acme.com")}
          variant="filled"
          splitChars={[",", " "]}
          maxDropdownHeight={0}
          maxTags={20}
          onChange={setDomains}
          {...form.getInputProps("emailDomains")}
        />

        <Button
          type="submit"
          mt="sm"
          disabled={!form.isDirty()}
          loading={isLoading}
        >
          {t("Save")}
        </Button>
      </form>
    </>
  );
}
