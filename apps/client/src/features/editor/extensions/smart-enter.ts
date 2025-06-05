import { Extension } from "@tiptap/core";

export const SmartEnter = Extension.create({
  name: "smartEnter",
  addOptions() {
    return {
      types: ["paragraph"],
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { schema, tr } = state;
        const head = state.selection.$head;

        if (!this.options.types.includes(head.parent.type.name)) {
          return false;
        }

        if (head.parent.content.size === 0) {
          return false;
        }

        if (head.parentOffset !== 0) {
          return false;
        }

        const currentPos = head.before();
        const nodeType = schema.nodes.paragraph;

        const newNode = nodeType.createAndFill();
        if (!newNode) {
          return false;
        }

        tr.insert(currentPos, newNode);
        view.dispatch(tr);

        return true;
      },
    };
  },
});
