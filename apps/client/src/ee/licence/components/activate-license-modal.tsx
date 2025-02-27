import * as z from "zod";
import React from "react";
import { Button, Group, Modal, Textarea } from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { useActivateMutation } from "@/ee/licence/queries/license-query.ts";
import { useDisclosure } from "@mantine/hooks";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import RemoveLicense from "@/ee/licence/components/remove-license.tsx";

export default function ActivateLicense() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [workspace] = useAtom(workspaceAtom);

  return (
    <Group justify="flex-end" wrap="nowrap" mb="sm">
      <Button onClick={open}>
        {workspace?.hasLicenseKey ? t("Update license") : t("Add license")}
      </Button>

      {workspace?.hasLicenseKey && <RemoveLicense />}

      <Modal
        size="550"
        opened={opened}
        onClose={close}
        title={t("Enterprise license")}
        centered
      >
        <ActivateLicenseForm onClose={close} />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  licenseKey: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface ActivateLicenseFormProps {
  onClose?: () => void;
}
export function ActivateLicenseForm({ onClose }: ActivateLicenseFormProps) {
  const { t } = useTranslation();
  const activateLicenseMutation = useActivateMutation();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      licenseKey: "",
    },
  });

  async function handleSubmit(data: { licenseKey: string }) {
    await activateLicenseMutation.mutateAsync(data.licenseKey);
    form.reset();
    onClose();
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Textarea
        label={t("License key")}
        description="Enter a valid enterprise license key. Contact sales@docmost.com to purchase one."
        placeholder={t("e.g eyJhb.....")}
        variant="filled"
        autosize
        minRows={3}
        maxRows={5}
        data-autofocus
        {...form.getInputProps("licenseKey")}
      />

      <Group justify="flex-end" mt="md">
        <Button
          type="submit"
          disabled={activateLicenseMutation.isPending}
          loading={activateLicenseMutation.isPending}
        >
          {t("Save")}
        </Button>
      </Group>
    </form>
  );
}
