import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { IconVariable } from "@tabler/icons-react";
import { Plugin } from "@tiptap/pm/state";
import { useTranslation } from "react-i18next";
import {
  getTemplateVariables,
  templateVariableNameKey,
  type TemplateVariable,
  TemplateVariableNode,
} from "@docmost/editor-ext";
import { openTemplateVariableEditor } from "./template-variable-editor";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    templateVariable: {
      insertTemplateVariable: () => ReturnType;
    };
  }
}

function VariableView({ node, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const field = node.attrs as TemplateVariable;
  return (
    <NodeViewWrapper as="span" contentEditable={false}>
      <button
        type="button"
        className="template-variable-chip"
        aria-label={t("Edit variable {{name}}", { name: field.name })}
        onClick={() => openTemplateVariableEditor(editor, field)}
      >
        <IconVariable size="1em" aria-hidden />
        {field.name}
      </button>
    </NodeViewWrapper>
  );
}

export const EditableTemplateVariable = TemplateVariableNode.extend({
  addCommands() {
    return {
      insertTemplateVariable: () => ({ editor, tr, dispatch }) => {
        if (!tr.selection.$from.parent.type.contentMatch.matchType(this.type)) return false;
        if (dispatch) openTemplateVariableEditor(editor);
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableView, { as: "span" });
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
