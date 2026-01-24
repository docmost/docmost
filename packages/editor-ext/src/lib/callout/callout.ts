import {
  findParentNode,
  mergeAttributes,
  Node,
  wrappingInputRule,
} from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutType, getValidCalloutType } from "./utils";

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface CalloutAttributes {
  /**
   * The type of callout.
   */
  type: CalloutType;
  /**
   * The custom icon name for the callout.
   */
  icon?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: CalloutAttributes) => ReturnType;
      unsetCallout: () => ReturnType;
      toggleCallout: (attributes?: CalloutAttributes) => ReturnType;
      updateCalloutType: (type: CalloutType) => ReturnType;
      updateCalloutIcon: (icon: string) => ReturnType;
    };
  }
}
/**
 * Matches a callout to a `:::` as input.
 */
export const inputRegex = /^:::([a-z]+)?[\s\n]$/;

export const Callout = Node.create<CalloutOptions>({
  name: "callout",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  content: "block+",
  group: "block",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout-type"),
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
      icon: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-callout-icon"),
        renderHTML: (attributes) => ({
          "data-callout-icon": attributes.icon,
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
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },

      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },

      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },

      updateCalloutType:
        (type: string) =>
        ({ commands }) =>
          commands.updateAttributes("callout", {
            type: getValidCalloutType(type),
          }),

      updateCalloutIcon:
        (icon: string) =>
        ({ commands }) =>
          commands.updateAttributes("callout", {
            icon: icon || null,
          }),
    };
  },

  addNodeView() {
    // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
    this.editor.isInitialized = true;

    return ReactNodeViewRenderer(this.options.view);
  },

  addKeyboardShortcuts() {
    return {
      //"Mod-Shift-c": () => this.editor.commands.toggleCallout(),

      /**
       * Handle the backspace key when deleting content.
       * Aims to stop merging callouts when deleting content in between.
       */
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;

        // If the selection is not empty, return false
        // and let other extension handle the deletion.
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;

        // If not at the start of current node, no joining will happen
        if ($from.parentOffset !== 0) {
          return false;
        }

        const previousPosition = $from.before($from.depth) - 1;

        // If nothing above to join with
        if (previousPosition < 1) {
          return false;
        }

        const previousPos = state.doc.resolve(previousPosition);

        // If resolving previous position fails, bail out
        if (!previousPos?.parent) {
          return false;
        }

        const previousNode = previousPos.parent;
        const parentNode = findParentNode(() => true)(selection);

        if (!parentNode) {
          return false;
        }

        const { node, pos, depth } = parentNode;

        // If current node is nested
        if (depth !== 1) {
          return false;
        }

        // If previous node is a callout, cut current node's content into it
        if (node.type !== this.type && previousNode.type === this.type) {
          const { content, nodeSize } = node;
          const { tr } = state;

          tr.delete(pos, pos + nodeSize);
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(previousPosition - 1))
          );
          tr.insert(previousPosition - 1, content);

          view.dispatch(tr);

          return true;
        }
        return false;
      },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => ({
          type: getValidCalloutType(match[1]),
        }),
      }),
    ];
  },
});
