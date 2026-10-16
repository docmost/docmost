import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  IntegrationLinkAttributes,
  IntegrationLinkOptions,
  sanitizeIntegrationUrl,
} from "./integration-link";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    integrationMention: {
      setIntegrationMention: (
        attributes: Partial<IntegrationLinkAttributes>,
      ) => ReturnType;
    };
  }
}

export const IntegrationMention = Node.create<IntegrationLinkOptions>({
  name: "integrationMention",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,

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
        parseHTML: (element: HTMLElement) =>
          sanitizeIntegrationUrl(element.getAttribute("data-url")),
        renderHTML: (attributes: IntegrationLinkAttributes) => ({
          "data-url": sanitizeIntegrationUrl(attributes.url),
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
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const safeUrl = sanitizeIntegrationUrl(HTMLAttributes["data-url"]);

    return [
      "span",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      ["a", { href: safeUrl, target: "_blank", rel: "noopener" }, safeUrl],
    ];
  },

  renderText({ node }) {
    return node.attrs.url;
  },

  addCommands() {
    return {
      setIntegrationMention:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...attrs,
              url: sanitizeIntegrationUrl(attrs.url),
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
