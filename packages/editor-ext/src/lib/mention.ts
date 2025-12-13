import { mergeAttributes, Node } from "@tiptap/core";
import { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";

export interface MentionNodeAttrs {
  /**
   *  unique mention node id (uuidv7)
   */
  id: string | null;
  /**
   * The label to be rendered by the editor as the displayed text for this mentioned
   * item, if provided.
   */
  label?: string | null;

  /**
   * the entity type - user or page
   */
  entityType: "user" | "page";

  /**
   * the entity id - userId or pageId
   */
  entityId?: string | null;

  /**
   * page slugId
   */
  slugId?: string | null;

  /**
   * the id of the user who initiated the mention
   */
  creatorId?: string;

  /**
   * the anchor hash for page mentions (e.g., "heading-1")
   */
  anchorId?: string;
}

export type MentionOptions<
  SuggestionItem = any,
  Attrs extends Record<string, any> = MentionNodeAttrs,
> = {
  /**
   * The HTML attributes for a mention node.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>;

  /**
   * A function to render the text of a mention.
   * @param props The render props
   * @returns The text
   * @example ({ options, node }) => `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
   */
  renderText: (props: {
    options: MentionOptions<SuggestionItem, Attrs>;
    node: ProseMirrorNode;
  }) => string;

  /**
   * A function to render the HTML of a mention.
   * @param props The render props
   * @returns The HTML as a ProseMirror DOM Output Spec
   * @example ({ options, node }) => ['span', { 'data-type': 'mention' }, `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`]
   */
  renderHTML: (props: {
    options: MentionOptions<SuggestionItem, Attrs>;
    node: ProseMirrorNode;
  }) => DOMOutputSpec;

  /**
   * Whether to delete the trigger character with backspace.
   * @default false
   */
  deleteTriggerWithBackspace: boolean;

  /**
   * The suggestion options.
   * @default {}
   * @example { char: '@', pluginKey: MentionPluginKey, command: ({ editor, range, props }) => { ... } }
   */
  suggestion: Omit<SuggestionOptions<SuggestionItem, Attrs>, "editor">;
};

/**
 * The plugin key for the mention plugin.
 * @default 'mention'
 */
export const MentionPluginKey = new PluginKey("mention");

/**
 * This extension allows you to insert mentions into the editor.
 * @see https://www.tiptap.dev/api/extensions/mention
 */
export const Mention = Node.create<MentionOptions>({
  name: "mention",

  priority: 101,

  addOptions() {
    return {
      HTMLAttributes: {},
      renderText({ options, node }) {
        return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
      },
      deleteTriggerWithBackspace: false,
      renderHTML({ options, node }) {
        const isUserMention = node.attrs.entityType === "user";
        return [
          "span",
          mergeAttributes(this.HTMLAttributes, options.HTMLAttributes),
          `${isUserMention ? options.suggestion.char : ""}${node.attrs.label ?? node.attrs.entityId}`,
        ];
      },
      suggestion: {
        char: "@",
        pluginKey: MentionPluginKey,
        command: ({ editor, range, props }) => {
          // increase range.to by one when the next node is of type "text"
          // and starts with a space character
          const nodeAfter = editor.view.state.selection.$to.nodeAfter;
          const overrideSpace = nodeAfter?.text?.startsWith(" ");

          if (overrideSpace) {
            range.to += 1;
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: props,
              },
              {
                type: "text",
                text: " ",
              },
            ])
            .run();

          // get reference to `window` object from editor element, to support cross-frame JS usage
          editor.view.dom.ownerDocument.defaultView
            ?.getSelection()
            ?.collapseToEnd();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          const allow = !!$from.parent.type.contentMatch.matchType(type);

          return allow;
        },
      },
    };
  },

  group: "inline",
  inline: true,
  selectable: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }

          return {
            "data-id": attributes.id,
          };
        },
      },

      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }

          return {
            "data-label": attributes.label,
          };
        },
      },

      entityType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-type"),
        renderHTML: (attributes) => {
          if (!attributes.entityType) {
            return {};
          }

          return {
            "data-entity-type": attributes.entityType,
          };
        },
      },

      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-id"),
        renderHTML: (attributes) => {
          if (!attributes.entityId) {
            return {};
          }

          return {
            "data-entity-id": attributes.entityId,
          };
        },
      },

      slugId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-slug-id"),
        renderHTML: (attributes) => {
          if (!attributes.slugId) {
            return {};
          }

          return {
            "data-slug-id": attributes.slugId,
          };
        },
      },

      creatorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-creator-id"),
        renderHTML: (attributes) => {
          if (!attributes.creatorId) {
            return {};
          }

          return {
            "data-creator-id": attributes.creatorId,
          };
        },
      },

      anchorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-anchor-id"),
        renderHTML: (attributes) => {
          if (!attributes.anchorId) {
            return {};
          }

          return {
            "data-anchor-id": attributes.anchorId,
          };
        },
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

  renderHTML({ node, HTMLAttributes }) {
    const mergedOptions = { ...this.options };

    mergedOptions.HTMLAttributes = mergeAttributes(
      { "data-type": this.name },
      this.options.HTMLAttributes,
      HTMLAttributes,
    );
    const html = this.options.renderHTML({
      options: mergedOptions,
      node,
    });

    if (typeof html === "string") {
      return [
        "span",
        mergeAttributes(
          { "data-type": this.name },
          this.options.HTMLAttributes,
          HTMLAttributes,
        ),
        html,
      ];
    }
    return html;
  },

  renderText({ node }) {
    return this.options.renderText({
      options: this.options,
      node,
    });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText(
                this.options.deleteTriggerWithBackspace
                  ? ""
                  : this.options.suggestion.char || "",
                pos,
                pos + node.nodeSize,
              );

              return false;
            }
          });

          return isMention;
        }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
