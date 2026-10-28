import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "../utils";

export type MicrosoftFolderAttributes = {
  driveId: string;
  itemId: string;
  webUrl: string;
  name: string;
};

export type MicrosoftFolderOptions = {
  HTMLAttributes: Record<string, any>;
  view: any;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    microsoftFolder: {
      setMicrosoftFolder: (attributes: MicrosoftFolderAttributes) => ReturnType;
    };
  }
}

export function sanitizeMicrosoftFolderUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const safeUrl = sanitizeUrl(value);
  return safeUrl.startsWith("https://") ? safeUrl : "";
}

export const MicrosoftFolder = Node.create<MicrosoftFolderOptions>({
  name: "microsoftFolder",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      driveId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-drive-id"),
        renderHTML: (attributes: MicrosoftFolderAttributes) => ({
          "data-drive-id": attributes.driveId,
        }),
      },
      itemId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-item-id"),
        renderHTML: (attributes: MicrosoftFolderAttributes) => ({
          "data-item-id": attributes.itemId,
        }),
      },
      webUrl: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          sanitizeMicrosoftFolderUrl(element.getAttribute("data-web-url")),
        renderHTML: (attributes: MicrosoftFolderAttributes) => ({
          "data-web-url": sanitizeMicrosoftFolderUrl(attributes.webUrl),
        }),
      },
      name: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-name"),
        renderHTML: (attributes: MicrosoftFolderAttributes) => ({
          "data-name": attributes.name,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = sanitizeMicrosoftFolderUrl(node.attrs.webUrl);
    const name = typeof node.attrs.name === "string" ? node.attrs.name : "";
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      href
        ? ["a", { href, target: "_blank", rel: "noopener" }, name || href]
        : name,
    ];
  },

  addCommands() {
    return {
      setMicrosoftFolder:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              ...attrs,
              webUrl: sanitizeMicrosoftFolderUrl(attrs.webUrl),
            },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
