import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "../utils";
import {
  IntegrationLinkAttributes,
  IntegrationLinkOptions,
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
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes["data-url"];
    const safeUrl = sanitizeUrl(url);

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

  addCommands() {
    return {
      setIntegrationMention:
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
    return ReactNodeViewRenderer(this.options.view);
  },
});
