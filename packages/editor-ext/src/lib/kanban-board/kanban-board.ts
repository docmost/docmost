import {
  mergeAttributes,
  Node,
} from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface KanbanColumn {
  id: string;
  title: string;
}

export interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  content: any;
}

export interface KanbanBoardOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    kanbanBoard: {
      insertKanbanBoard: () => ReturnType;
    };
  }
}

export const KanbanBoard = Node.create<KanbanBoardOptions>({
  name: "kanbanBoard",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  atom: true,
  draggable: true,
  selectable: false,

  addAttributes() {
    return {
      columns: {
        default: [
          { id: "todo", title: "To Do" },
          { id: "in-progress", title: "In Progress" },
          { id: "done", title: "Done" },
        ],
        parseHTML: (element) => {
          const columns = element.getAttribute("data-columns");
          return columns ? JSON.parse(columns) : null;
        },
        renderHTML: (attributes) => {
          return {
            "data-columns": JSON.stringify(attributes.columns),
          };
        },
      },
      cards: {
        default: [],
        parseHTML: (element) => {
          const cards = element.getAttribute("data-cards");
          return cards ? JSON.parse(cards) : null;
        },
        renderHTML: (attributes) => {
          return {
            "data-cards": JSON.stringify(attributes.cards),
          };
        },
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
        HTMLAttributes,
      ),
    ];
  },

  addCommands() {
    return {
      insertKanbanBoard:
        () =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                columns: [
                  { id: "todo", title: "To Do" },
                  { id: "in-progress", title: "In Progress" },
                  { id: "done", title: "Done" },
                ],
                cards: [],
              },
            });
          },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
