import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "./utils";

export interface LinearIssueAttributes {
  issueId?: string | null;
  identifier?: string | null;
  url?: string | null;
  title?: string | null;
}

export interface LinearIssueOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linearIssue: {
      setLinearIssue: (attributes: LinearIssueAttributes) => ReturnType;
    };
  }
}

// Inline atom node referencing a Linear issue. Persists only stable fields
// (issueId, identifier, url, cached title); live fields are fetched per-viewer.
export const LinearIssue = Node.create<LinearIssueOptions>({
  name: "linearIssue",
  priority: 101,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      issueId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-issue-id"),
        renderHTML: (attributes) =>
          attributes.issueId ? { "data-issue-id": attributes.issueId } : {},
      },
      identifier: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-identifier"),
        renderHTML: (attributes) =>
          attributes.identifier
            ? { "data-identifier": attributes.identifier }
            : {},
      },
      url: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-url");
          return raw ? sanitizeUrl(raw) : null;
        },
        renderHTML: (attributes) =>
          attributes.url ? { "data-url": sanitizeUrl(attributes.url) } : {},
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) =>
          attributes.title ? { "data-title": attributes.title } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      node.attrs.identifier ?? node.attrs.title ?? "Linear issue",
    ];
  },

  renderText({ node }) {
    return node.attrs.identifier ?? node.attrs.url ?? "";
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setLinearIssue:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs: attributes },
            { type: "text", text: " " },
          ]),
    };
  },
});
