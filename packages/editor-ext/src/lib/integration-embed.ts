import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface IntegrationEmbedAttributes {
  integrationId?: string;
  resourceId?: string;
  resourceKey?: string;
  labelAtInsert?: string;
  renderKind?: "item-card" | "table-report" | string;
  params?: Record<string, unknown> | null;
}

/** Structural twin of tiptap's InputRuleMatch — lets callers supply dynamic finders. */
export interface IntegrationEmbedInputRuleMatch {
  index: number;
  text: string;
  replaceWith?: string;
  match?: RegExpMatchArray;
  data?: Record<string, any>;
}

export interface IntegrationEmbedInputRule {
  find: RegExp | ((text: string) => IntegrationEmbedInputRuleMatch | null);
  getAttributes: (
    match: RegExpMatchArray & { data?: Record<string, any> },
  ) => IntegrationEmbedAttributes;
}

export interface IntegrationEmbedOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
  inputRules: IntegrationEmbedInputRule[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    integrationEmbed: {
      setIntegrationEmbed: (attributes: IntegrationEmbedAttributes) => ReturnType;
    };
  }
}

function parseParams(element: HTMLElement): Record<string, unknown> | null {
  const raw = element.getAttribute("data-params");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed persisted attrs and fall back to null.
  }
  return null;
}

export const IntegrationEmbed = Node.create<IntegrationEmbedOptions>({
  name: "integrationEmbed",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {}, view: null, inputRules: [] };
  },

  addAttributes() {
    return {
      integrationId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-integration-id") ?? "",
        renderHTML: (attributes: IntegrationEmbedAttributes) => ({
          "data-integration-id": attributes.integrationId ?? "",
        }),
      },
      resourceId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-resource-id") ?? "",
        renderHTML: (attributes: IntegrationEmbedAttributes) => ({
          "data-resource-id": attributes.resourceId ?? "",
        }),
      },
      resourceKey: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-resource-key") ?? "",
        renderHTML: (attributes: IntegrationEmbedAttributes) => ({
          "data-resource-key": attributes.resourceKey ?? "",
        }),
      },
      labelAtInsert: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes: IntegrationEmbedAttributes) => ({
          "data-label": attributes.labelAtInsert ?? "",
        }),
      },
      renderKind: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-render-kind") ?? "",
        renderHTML: (attributes: IntegrationEmbedAttributes) => ({
          "data-render-kind": attributes.renderKind ?? "",
        }),
      },
      params: {
        default: null,
        parseHTML: parseParams,
        renderHTML: (attributes: IntegrationEmbedAttributes) => {
          if (!attributes.params) return {};
          return { "data-params": JSON.stringify(attributes.params) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addCommands() {
    return {
      setIntegrationEmbed:
        (attrs: IntegrationEmbedAttributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addInputRules() {
    return (this.options.inputRules ?? []).map((rule) =>
      nodeInputRule({
        find: rule.find,
        type: this.type,
        getAttributes: rule.getAttributes,
      }),
    );
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
