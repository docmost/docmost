import { Editor } from "@tiptap/core";
import LinearIssueCreate from "./linear-issue-create";
import { createEditorPopup } from "./floating-popup";
import { ILinearIssue } from "@/features/linear/types/linear.types";

// Opens a create-issue popup seeded by the selection; on success replaces it
// with a linearIssue node, using the current user's Linear token.
export function openLinearIssueCreate(editor: Editor) {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, " ").trim();

  createEditorPopup(
    editor,
    LinearIssueCreate,
    ({ destroy }) => ({
      initialTitle: selectedText,
      onCreate: (issue: ILinearIssue) => {
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, [
            {
              type: "linearIssue",
              attrs: {
                issueId: issue.id,
                identifier: issue.identifier,
                url: issue.url,
                title: issue.title,
              },
            },
            { type: "text", text: " " },
          ])
          .run();
        destroy();
      },
      onClose: () => {
        destroy();
        editor.commands.focus();
      },
    }),
    to,
  );
}
