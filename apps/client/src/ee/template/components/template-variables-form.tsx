import { useEffect, useRef, useState } from "react";
import { Button, Group, Modal, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getTemplateVariables, type TemplateVariable } from "@docmost/editor-ext";
import { getTemplateById } from "../services/template-service";
import type { ITemplate, TemplateVariableValues } from "../types/template.types";

type Fields = { template: ITemplate; variables: TemplateVariable[] };
type UseTemplate = (
  template: ITemplate,
  values?: TemplateVariableValues,
) => Promise<boolean | void> | void;

export function useTemplateVariables(onUse: UseTemplate, actionLabel: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<Fields | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    return () => { request.current++; };
  }, []);

  function cancel() {
    request.current++;
    setLoadingId(null);
    setFields(null);
  }

  async function choose(template: ITemplate) {
    const current = ++request.current;
    setLoadingId(template.id);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["template", template.id],
        queryFn: () => getTemplateById(template.id),
        staleTime: 0,
      });
      if (request.current !== current) return;
      const variables = getTemplateVariables(detail.content);
      if (variables.length) {
        setFields({ template: detail, variables });
      } else {
        await onUse(detail);
      }
    } catch {
      if (request.current === current) {
        notifications.show({ message: t("Failed to load template"), color: "red" });
      }
    } finally {
      if (request.current === current) setLoadingId(null);
    }
  }

  const form = fields && (
    <TemplateVariablesForm
      key={fields.template.id}
      {...fields}
      busy={!!loadingId}
      actionLabel={actionLabel}
      onClose={cancel}
      onSubmit={async (values) => {
        setLoadingId(fields.template.id);
        try {
          if ((await onUse(fields.template, values)) !== false) setFields(null);
        } finally {
          setLoadingId(null);
        }
      }}
    />
  );

  return { choose, cancel, form, loadingId };
}

type FormProps = Fields & {
  busy: boolean;
  actionLabel: string;
  onClose: () => void;
  onSubmit: (values: TemplateVariableValues) => void;
};

function TemplateVariablesForm({ template, variables, busy, actionLabel, onClose, onSubmit }: FormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<TemplateVariableValues>(() =>
    Object.fromEntries(variables.map(({ id }) => [id, ""])),
  );
  const change = (id: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  return (
    <Modal
      opened centered
      title={template.title || t("Untitled")}
      onClose={onClose}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit(values);
      }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t("These values become editable text on the page.")}</Text>
          {variables.map((field, index) => {
            const input = {
              label: field.name,
              value: values[field.id],
              "data-autofocus": index === 0 || undefined,
            };
            switch (field.fieldType) {
              case "select":
                return (
                  <Select
                    key={field.id} {...input}
                    value={values[field.id] || null}
                    data={field.options}
                    placeholder={t("Select an option")}
                    clearable
                    onChange={(value) => change(field.id, value ?? "")}
                  />
                );
              case "multiline":
                return (
                  <Textarea
                    key={field.id} {...input}
                    autosize minRows={3} maxRows={8}
                    onChange={(event) => change(field.id, event.currentTarget.value)}
                  />
                );
              case "text":
                return (
                  <TextInput
                    key={field.id} {...input}
                    onChange={(event) => change(field.id, event.currentTarget.value)}
                  />
                );
            }
          })}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
            <Button type="submit" loading={busy}>{actionLabel}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
