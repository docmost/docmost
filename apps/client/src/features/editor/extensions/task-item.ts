import { TaskItem as BaseTaskItem } from "@tiptap/extension-list";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Checks whether the current user has permission to edit the document.
 * In Docmost, when a user switches to Read Mode, `editor.isEditable` becomes false,
 * but `editor.storage.canEdit` preserves whether the user actually has permission
 * to edit the document (allowing tasks to be checked/unchecked in Read Mode).
 */
export const canEditDocument = (editor: Editor): boolean => {
  if (typeof (editor.storage as any)?.canEdit === "boolean") {
    return (editor.storage as any).canEdit;
  }
  return editor.isEditable;
};

export const TaskItem = BaseTaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement("li");
      const checkboxWrapper = document.createElement("label");
      const checkboxStyler = document.createElement("span");
      const checkbox = document.createElement("input");
      const content = document.createElement("div");

      checkboxWrapper.contentEditable = "false";
      checkbox.type = "checkbox";

      const hasEditPermission = canEditDocument(editor);
      checkbox.disabled = !hasEditPermission;

      // Prevent mousedown from focusing/blurring or moving selection on desktop
      const preventDefault = (event: Event) => event.preventDefault();
      checkbox.addEventListener("mousedown", preventDefault);
      checkboxWrapper.addEventListener("mousedown", preventDefault);

      // On mobile touch devices, stop propagation to prevent ProseMirror from
      // treating the touch as a cursor placement or text-editing interaction.
      const stopPropagation = (event: Event) => event.stopPropagation();
      checkbox.addEventListener("touchstart", stopPropagation, { passive: true });
      checkboxWrapper.addEventListener("touchstart", stopPropagation, { passive: true });
      checkbox.addEventListener("click", stopPropagation);
      checkboxWrapper.addEventListener("click", stopPropagation);

      const updateA11y = (currentNode: PMNode) => {
        const a11y = (this.options as any)?.a11y;
        const checkboxLabel =
          a11y?.checkboxLabel?.(currentNode, !!currentNode.attrs.checked) ||
          `Task item checkbox for ${currentNode.textContent || "empty task item"}`;
        checkbox.setAttribute("aria-label", checkboxLabel);
      };
      updateA11y(node);

      checkbox.addEventListener("change", (event) => {
        const isAllowed = canEditDocument(editor);

        // If user doesn't have permission and no custom onReadOnlyChecked handler is configured, revert
        if (!isAllowed && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked;
          return;
        }

        const { checked } = event.target as HTMLInputElement;

        if (isAllowed && typeof getPos === "function") {
          const position = getPos();
          if (typeof position !== "number") {
            return;
          }

          const { tr } = editor.state;
          const currentNode = tr.doc.nodeAt(position);
          if (!currentNode) {
            return;
          }

          // Directly update the node markup without calling .focus().
          // This avoids opening the virtual keyboard on mobile and prevents the
          // cursor and viewport from jumping to the bottom/next section.
          tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            checked,
          });

          editor.view.dispatch(tr);
        }

        if (!isAllowed && this.options.onReadOnlyChecked) {
          if (!this.options.onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked;
          }
        }
      });

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      listItem.dataset.checked = String(node.attrs.checked);
      checkbox.checked = !!node.attrs.checked;

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          listItem.dataset.checked = String(updatedNode.attrs.checked);
          checkbox.checked = !!updatedNode.attrs.checked;
          checkbox.disabled = !canEditDocument(editor);
          updateA11y(updatedNode);

          return true;
        },
      };
    };
  },
});
