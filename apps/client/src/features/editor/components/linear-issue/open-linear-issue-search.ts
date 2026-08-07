import { Editor } from "@tiptap/core";
import LinearIssueSearch from "./linear-issue-search";
import { createEditorPopup } from "./floating-popup";
import { ILinearIssue } from "@/features/linear/types/linear.types";

// Opens a caret-anchored issue search popup that inserts a linearIssue node on
// select. Driven by the slash menu to avoid @-mention trigger conflicts.
export function openLinearIssueSearch(editor: Editor) {
  const { from } = editor.state.selection;

  createEditorPopup(
    editor,
    LinearIssueSearch,
    ({ destroy }) => ({
      onSelect: (issue: ILinearIssue) => {
        editor
          .chain()
          .focus()
          .setLinearIssue({
            issueId: issue.id,
            identifier: issue.identifier,
            url: issue.url,
            title: issue.title,
          })
          .run();
        destroy();
      },
      onClose: () => {
        destroy();
        editor.commands.focus();
      },
    }),
    from,
  );
}
