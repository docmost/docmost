import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getTemplateVariables, templateVariableNameKey, type TemplateVariable } from "@docmost/editor-ext";
import { getTemplateById } from "../services/template-service";
import type { ITemplate, TemplateVariableValues } from "../types/template.types";
import ReadonlyTemplateEditor from "./readonly-template-editor";
import { FillableTemplateVariable, TemplateVariableInputContext } from "./template-variable-input";
import classes from "./template-variables-form.module.css";

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
  const fieldsByName = useMemo(
    () => new Map(variables.map((field) => [templateVariableNameKey(field.name), field])),
    [variables],
  );
  const [values, setValues] = useState<TemplateVariableValues>(() =>
    Object.fromEntries(variables.map(({ id }) => [id, ""])),
  );
  const change = (id: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  return (
    <Modal.Root
      opened
      centered
      size={900}
      classNames={{ content: classes.dialog }}
      onClose={onClose}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header className={classes.header}>
          <Modal.Title data-autofocus tabIndex={-1}>
            {template.icon && <span aria-hidden="true">{template.icon} </span>}
            {t("Use template")}
          </Modal.Title>
          <Modal.CloseButton aria-label={t("Close")} disabled={busy} />
        </Modal.Header>
        <div className={classes.document}>
          <TemplateVariableInputContext.Provider value={{ fieldsByName, values, change, busy }}>
            <ReadonlyTemplateEditor template={template} variableNode={FillableTemplateVariable} />
          </TemplateVariableInputContext.Provider>
        </div>
        <div className={classes.footer}>
          <Text size="xs" c="dimmed">{t("These values become editable text on the page.")}</Text>
          <Group gap="xs" wrap="nowrap" ms="auto">
            <Button variant="default" onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
            <Button loading={busy} onClick={() => onSubmit(values)}>{actionLabel}</Button>
          </Group>
        </div>
      </Modal.Content>
    </Modal.Root>
  );
}
