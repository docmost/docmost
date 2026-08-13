import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "../utils";

export interface IntegrationLinkOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface IntegrationLinkAttributes {
  url: string;
  provider: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    integrationLink: {
      setIntegrationLink: (
        attributes: Partial<IntegrationLinkAttributes>,
      ) => ReturnType;
    };
  }
}

export const IntegrationLink = Node.create<IntegrationLinkOptions>({
  name: "integrationLink",
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
      url: {
        default: "",
        parseHTML: (element: HTMLElement) => {
          const url = element.getAttribute("data-url");
          return sanitizeUrl(url);
        },
        renderHTML: (attributes: IntegrationLinkAttributes) => ({
          "data-url": sanitizeUrl(attributes.url),
        }),
      },
      provider: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-provider"),
        renderHTML: (attributes: IntegrationLinkAttributes) => ({
          "data-provider": attributes.provider,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes["data-url"];
    const safeUrl = sanitizeUrl(url);

    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      ["a", { href: safeUrl, target: "_blank", rel: "noopener" }, safeUrl],
    ];
  },

  addCommands() {
    return {
      setIntegrationLink:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...attrs,
              url: sanitizeUrl(attrs.url),
            },
          });
        },
    };
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
