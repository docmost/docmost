import { z } from "zod/v4";
import React, { useRef } from "react";
import { Button, Divider, Group, Modal, Stack, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useTranslation } from "react-i18next";
import { useActivateMutation } from "@/ee/licence/queries/license-query.ts";
import { useDisclosure } from "@mantine/hooks";
import { useAtom } from "jotai";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import RemoveLicense from "@/ee/licence/components/remove-license.tsx";

export default function ActivateLicense() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [entitlements] = useAtom(entitlementAtom);
  const hasLicense = entitlements != null && entitlements.tier !== "free";

  return (
    <Group justify="flex-end" wrap="nowrap" mb="sm">
      <Button onClick={open}>
        {hasLicense ? t("Update license") : t("Add license")}
      </Button>

      {hasLicense && <RemoveLicense />}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      licenseKey: "",
    },
  });

  async function handleSubmit(data: { licenseKey: string }) {
    await activateLicenseMutation.mutateAsync(data.licenseKey);
    form.reset();
    onClose?.();
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string)?.trim();
      if (content) {
        form.setFieldValue("licenseKey", content);
        handleSubmit({ licenseKey: content });
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <input
        type="file"
        accept=".txt"
        ref={fileInputRef}
        onChange={handleFileUpload}
        hidden
      />

      <Stack gap="xs">
        <Textarea
          label={t("License key")}
          placeholder={t("e.g eyJhb.....")}
          variant="filled"
          autosize
          minRows={3}
          maxRows={5}
          data-autofocus
          {...form.getInputProps("licenseKey")}
        />

        <Group justify="flex-end">
          <Button
            type="submit"
            disabled={activateLicenseMutation.isPending}
            loading={activateLicenseMutation.isPending}
          >
            {t("Save")}
          </Button>
        </Group>

        <Divider label={t("Or")} labelPosition="center" />

        <Group justify="center">
          <Button
            variant="light"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("Upload license file")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
