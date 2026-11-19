import { useId } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { useTranslation } from "react-i18next";
import {
  getTemplateVariables,
  templateVariableNameKey,
  type TemplateVariable,
  TemplateVariableNode,
} from "@docmost/editor-ext";
import { openTemplateVariableEditor } from "./template-variable-editor";
import { templateVariableTypes } from "./template-variable-types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateVariable: {
      insertTemplateVariable: () => ReturnType;
    };
  }
}

function VariableView({ node, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const typeId = useId();
  const field = node.attrs as TemplateVariable;
  const { icon: Icon, label } = templateVariableTypes[field.fieldType];
  const editProps = editor.isEditable ? {
    type: "button",
    "aria-label": t("Edit variable {{name}}", { name: field.name }),
    "aria-describedby": typeId,
    onClick: () => openTemplateVariableEditor(editor, field),
  } : {};

  return (
    <NodeViewWrapper
      as={editor.isEditable ? "button" : "span"}
      className="template-variable-chip"
      contentEditable={false}
      {...editProps}
    >
      <Icon size="1em" aria-hidden="true" />
      <span>{field.name}</span>{" "}
      <span className="template-variable-type" id={typeId}>{t(label)}</span>
    </NodeViewWrapper>
  );
}

export const TemplateVariableWithChip = TemplateVariableNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(VariableView, { as: "span" });
  },
});

export const EditableTemplateVariable = TemplateVariableWithChip.extend({
  addCommands() {
    return {
      insertTemplateVariable: () => ({ editor, tr, dispatch }) => {
        if (!tr.selection.$from.parent.type.contentMatch.matchType(this.type)) return false;
        if (dispatch) openTemplateVariableEditor(editor);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, before, after) => {
        if (!transactions.some((tr) => tr.getMeta("paste") || tr.getMeta("uiEvent") === "drop")) return;

        // A pasted chip can come from another template or predate a rename.
        const fields = getTemplateVariables(before.doc.toJSON());
        const byId = new Map(fields.map((field) => [field.id, field]));
        const byName = new Map(fields.map((field) => [templateVariableNameKey(field.name), field]));
        const tr = after.tr;
        after.doc.descendants((node, pos) => {
          if (node.type !== this.type) return;
          const field = node.attrs as TemplateVariable;
          const key = templateVariableNameKey(field.name);
          const definition = byId.get(field.id) ?? byName.get(key) ?? field;
          const attrs = { ...node.attrs, ...definition };
          if (!node.hasMarkup(this.type, attrs, node.marks)) {
            tr.setNodeMarkup(pos, undefined, attrs, node.marks);
          }
          byId.set(field.id, definition);
          byName.set(templateVariableNameKey(definition.name), definition);
        });
        return tr.docChanged ? tr : null;
      },
    })];
  },
});
