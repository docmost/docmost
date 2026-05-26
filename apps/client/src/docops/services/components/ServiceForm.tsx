import {
  Button,
  Group,
  Select,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";
import type { CreateServicePayload, LifecycleState } from "../types/service.types";
import { useTagsQuery } from "../hooks/useServices";

interface ServiceFormValues {
  code: string;
  name: string;
  description: string;
  domain: string;
  lifecycleState: LifecycleState;
  tags: string[];
}

interface ServiceFormProps {
  initialValues?: Partial<ServiceFormValues>;
  isEditMode?: boolean;
  isLoading?: boolean;
  onSubmit: (payload: CreateServicePayload) => void;
  onCancel?: () => void;
}

export function ServiceForm({
  initialValues,
  isEditMode = false,
  isLoading = false,
  onSubmit,
  onCancel,
}: ServiceFormProps) {
  const { t } = useTranslation();
  const { data: tagsData } = useTagsQuery();

  const form = useForm<ServiceFormValues>({
    initialValues: {
      code: initialValues?.code ?? "",
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      domain: initialValues?.domain ?? "",
      lifecycleState: initialValues?.lifecycleState ?? "active",
      tags: initialValues?.tags ?? [],
    },
    validate: {
      code: (v) => {
        if (!isEditMode && !v) return t("Service code is required");
        if (!isEditMode && !/^[a-z0-9_-]+$/.test(v))
          return t("Code must contain only lowercase letters, numbers, hyphens and underscores");
        if (!isEditMode && (v.length < 1 || v.length > 64))
          return t("Code must be between 1 and 64 characters");
        return null;
      },
      name: (v) =>
        !v || v.trim().length < 2
          ? t("Name must be at least 2 characters")
          : null,
    },
  });

  const handleSubmit = (values: ServiceFormValues) => {
    onSubmit({
      code: values.code,
      name: values.name,
      description: values.description || undefined,
      domain: values.domain || undefined,
      lifecycleState: values.lifecycleState,
      tags: values.tags.length > 0 ? values.tags : undefined,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        <TextInput
          label={t("Service code")}
          placeholder="my-service"
          required={!isEditMode}
          disabled={isEditMode}
          description={
            !isEditMode
              ? t("Lowercase letters, numbers, hyphens, underscores. Cannot be changed later.")
              : undefined
          }
          aria-label={t("Service code")}
          {...form.getInputProps("code")}
        />

        <TextInput
          label={t("Service name")}
          placeholder={t("My Service")}
          required
          aria-label={t("Service name")}
          {...form.getInputProps("name")}
        />

        <Textarea
          label={t("Description")}
          placeholder={t("Short description of the service")}
          autosize
          minRows={2}
          maxRows={5}
          aria-label={t("Description")}
          {...form.getInputProps("description")}
        />

        <TextInput
          label={t("Domain")}
          placeholder={t("e.g. payments, identity")}
          aria-label={t("Domain")}
          {...form.getInputProps("domain")}
        />

        <Select
          label={t("Lifecycle status")}
          data={[
            { value: "active", label: t("active") },
            { value: "deprecated", label: t("deprecated") },
            { value: "retired", label: t("retired") },
          ]}
          aria-label={t("Lifecycle status")}
          {...form.getInputProps("lifecycleState")}
        />

        <TagsInput
          label={t("Tags")}
          placeholder={t("Add tags...")}
          data={tagsData?.map((t) => t.name) ?? []}
          splitChars={[",", " "]}
          aria-label={t("Tags")}
          {...form.getInputProps("tags")}
        />

        <Group justify="flex-end" mt="sm">
          {onCancel && (
            <Button variant="default" onClick={onCancel} type="button">
              {t("Cancel")}
            </Button>
          )}
          <Button type="submit" loading={isLoading}>
            {isEditMode ? t("Save changes") : t("Create service")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
