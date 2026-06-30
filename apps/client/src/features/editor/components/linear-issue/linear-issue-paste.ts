import { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";
import { sanitizeUrl } from "@docmost/editor-ext";
import { searchLinearIssues } from "@/features/linear/services/linear-service";

// e.g. https://linear.app/acme/issue/ENG-123/some-slug
const LINEAR_ISSUE_REGEX =
  /^https?:\/\/linear\.app\/[^/]+\/issue\/([a-z0-9]+-\d+)(?:\/[^?#\s]*)?(?:[?#]\S*)?$/i;

export function getLinearIssueIdentifier(url: string): string | null {
  const match = LINEAR_ISSUE_REGEX.exec(url.trim());
  return match ? match[1].toUpperCase() : null;
}

export async function createLinearIssueAction(
  url: string,
  view: EditorView,
  pos: number,
) {
  // the doc may have changed during the async lookup (collab edit, typing), so
  // resolve the captured position to the nearest valid inline position rather
  // than risk a RangeError or a block-boundary position that rejects inline
  // content
  const safePos = () => {
    const { doc } = view.state;
    const clamped = Math.min(Math.max(pos, 0), doc.content.size);
    return TextSelection.near(doc.resolve(clamped)).from;
  };

  const insertAsLink = () => {
    const { schema } = view.state;
    const at = safePos();
    const tr = view.state.tr.insertText(url, at);
    tr.addMark(at, at + url.length, schema.marks.link.create({ href: url }));
    view.dispatch(tr);
  };

  const identifier = getLinearIssueIdentifier(url);
  if (!identifier) return insertAsLink();

  try {
    const result = await searchLinearIssues(identifier);
    const issue = result.connected
      ? (result.issues.find((i) => i.identifier.toUpperCase() === identifier) ??
        null)
      : null;
    if (!issue) return insertAsLink();

    const node = view.state.schema.nodes.linearIssue.create({
      issueId: issue.id,
      identifier: issue.identifier,
      url: sanitizeUrl(issue.url ?? url),
      title: issue.title,
    });
    const at = safePos();
    view.dispatch(view.state.tr.replaceWith(at, at, node));
  } catch {
    insertAsLink();
  }
}
