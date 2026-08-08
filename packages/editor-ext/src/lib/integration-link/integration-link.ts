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
  unfurlData: Record<string, any> | null;
  status: "pending" | "loaded" | "error";
}

// Shared by IntegrationLink (block) and IntegrationMention (inline) so both
// serialize the same attrs and stay convertible into each other.
export function createIntegrationAttributes() {
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
      parseHTML: (element: HTMLElement) => element.getAttribute("data-provider"),
      renderHTML: (attributes: IntegrationLinkAttributes) => ({
        "data-provider": attributes.provider,
      }),
    },
    unfurlData: {
      default: null,
      parseHTML: (element: HTMLElement) => {
        const data = element.getAttribute("data-unfurl");
        if (!data) return null;
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      },
      renderHTML: (attributes: IntegrationLinkAttributes) => ({
        "data-unfurl": attributes.unfurlData
          ? JSON.stringify(attributes.unfurlData)
          : null,
      }),
    },
    status: {
      default: "pending",
      parseHTML: (element: HTMLElement) =>
        element.getAttribute("data-status") ?? "pending",
      renderHTML: (attributes: IntegrationLinkAttributes) => ({
        "data-status": attributes.status,
      }),
    },
  };
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
    return createIntegrationAttributes();
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
