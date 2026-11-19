import { createContext, useContext, useId, type ChangeEvent } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { TemplateVariableNode, templateVariableNameKey, type TemplateVariable } from "@docmost/editor-ext";
import type { TemplateVariableValues } from "../types/template.types";
import { templateVariableTypes } from "./template-variable-types";
import classes from "./template-variables-form.module.css";

export const TemplateVariableInputContext = createContext<{
  fieldsByName: Map<string, TemplateVariable>;
  values: TemplateVariableValues;
  change: (id: string, value: string) => void;
  busy: boolean;
} | null>(null);

function VariableInput({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const { fieldsByName, values, change, busy } = useContext(TemplateVariableInputContext)!;
  const field = fieldsByName.get(templateVariableNameKey(node.attrs.name))!;
  const Icon = templateVariableTypes[field.fieldType].icon;
  const control = {
    id: inputId,
    className: classes.control,
    value: values[field.id],
    disabled: busy,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      change(field.id, event.currentTarget.value),
  };

  return (
    <NodeViewWrapper as="span" className={classes.field} data-field-type={field.fieldType} contentEditable={false}>
      <label htmlFor={inputId} className={classes.label}>
        <Icon size={14} aria-hidden="true" />
        {field.name}
      </label>
      {field.fieldType === "select" ? (
        <select {...control} data-empty={!control.value || undefined}>
          <option value="">{t("Select an option")}</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.fieldType === "multiline" ? (
        <textarea {...control} rows={2} />
      ) : (
        <input {...control} type="text" />
      )}
    </NodeViewWrapper>
  );
}

export const FillableTemplateVariable = TemplateVariableNode.extend({
  addNodeView() {
    // Native controls own their keyboard, selection, and clipboard events.
    return ReactNodeViewRenderer(VariableInput, { as: "span", stopEvent: () => true });
  },
});
