import { useState } from "react";
import { Autocomplete, Button, Group, Select, Stack, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/core";
import { v7 as uuid7 } from "uuid";
import {
  getTemplateVariables,
  templateVariableNameKey,
  type TemplateVariable,
} from "@docmost/editor-ext";
import i18n from "@/i18n";
import { templateVariableTypes } from "./template-variable-types";

export function openTemplateVariableEditor(editor: Editor, selected?: TemplateVariable) {
  const fields = getTemplateVariables(editor.getJSON());
  const field = selected && fields.find((item) =>
    templateVariableNameKey(item.name) === templateVariableNameKey(selected.name),
  );
  const modalId = modals.open({
    title: i18n.t(field ? "Edit variable" : "Insert variable"),
    centered: true,
    children: (
      <VariableForm
        field={field}
        fields={fields}
        onClose={() => modals.close(modalId)}
        onSave={(definition) => {
          if (editor.isDestroyed) return;
          if (field) {
            const tr = editor.state.tr;
            const oldName = templateVariableNameKey(field.name);
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === "templateVariable" &&
                  templateVariableNameKey(node.attrs.name) === oldName) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...definition }, node.marks);
              }
            });
            editor.view.dispatch(tr);
          } else {
            const marks = editor.state.storedMarks ?? editor.state.selection.$from.marks();
            editor.chain().focus().insertContent({
              type: "templateVariable",
              attrs: definition,
              marks: marks.map((mark) => mark.toJSON()),
            }).run();
          }
          modals.close(modalId);
        }}
      />
    ),
  });
}

type FormProps = {
  field?: TemplateVariable;
  fields: TemplateVariable[];
  onClose: () => void;
  onSave: (definition: TemplateVariable) => void;
};

function VariableForm({ field, fields, onClose, onSave }: FormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<TemplateVariable["fieldType"]>(field?.fieldType ?? "text");
  const [choices, setChoices] = useState(field?.options.join("\n") ?? "");
  const otherFields = fields.filter((variable) => variable.id !== field?.id);
  const nameKey = templateVariableNameKey(name);
  const existing = otherFields.find((variable) => templateVariableNameKey(variable.name) === nameKey);
  const options = Array.from(new Set(
    choices.split("\n").map((line) => line.trim()).filter(Boolean),
  ));
  const canSave = !!name.trim() && (!!existing || type !== "select" || options.length > 0);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!canSave) return;
      onSave(existing ?? {
        id: field?.id ?? uuid7(),
        name: name.trim(),
        fieldType: type,
        options: type === "select" ? options : [],
      });
    }}>
      <Stack gap="md">
        <Autocomplete
          label={t("Variable name")}
          placeholder={t("e.g. Project name")}
          description={existing ? t("This name reuses an existing variable.") : undefined}
          data={otherFields.map((variable) => variable.name)}
          value={name}
          onChange={setName}
          data-autofocus
        />
        <Select
          label={t("Field type")}
          data={Object.entries(templateVariableTypes).map(([value, { label }]) => ({
            value,
            label: t(label),
          }))}
          value={existing?.fieldType ?? type}
          onChange={(value) => setType(value as TemplateVariable["fieldType"])}
          allowDeselect={false}
          disabled={!!existing}
        />
        {(existing?.fieldType ?? type) === "select" && (
          <Textarea
            label={t("Choices")}
            description={t("Enter one choice per line.")}
            autosize minRows={3} maxRows={6}
            value={existing ? existing.options.join("\n") : choices}
            onChange={(event) => setChoices(event.currentTarget.value)}
            disabled={!!existing}
          />
        )}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>{t("Cancel")}</Button>
          <Button type="submit" disabled={!canSave}>{t(field ? "Save" : "Insert")}</Button>
        </Group>
      </Stack>
    </form>
  );
}
