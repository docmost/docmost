import {
  mergeAttributes,
  Node,
} from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface DataTableColumn {
  id: string;
  name: string;
  type: string;
  width?: number;
  options?: { id: string; label: string; color: string; group?: string }[];
}

export interface DataTableRow {
  id: string;
  content: any;
  [key: string]: any;
}

export interface DataTableFilter {
  id: string;
  columnId: string;
  operator: string;
  value: any;
}

export interface DataTableOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dataTable: {
      insertDataTable: () => ReturnType;
    };
  }
}

export const DataTable = Node.create<DataTableOptions>({
  name: "dataTable",

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
          { id: "name", name: "Name", type: "text", width: 250 },
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
      rows: {
        default: [
          { id: "row-1", content: null, name: "" },
        ],
        parseHTML: (element) => {
          const rows = element.getAttribute("data-rows");
          return rows ? JSON.parse(rows) : null;
        },
        renderHTML: (attributes) => {
          return {
            "data-rows": JSON.stringify(attributes.rows),
          };
        },
      },
      filters: {
        default: [],
        parseHTML: (element) => {
          const filters = element.getAttribute("data-filters");
          return filters ? JSON.parse(filters) : [];
        },
        renderHTML: (attributes) => {
          return {
            "data-filters": JSON.stringify(attributes.filters || []),
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
      insertDataTable:
        () =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                columns: [
                  { id: "name", name: "Name", type: "text", width: 250 },
                ],
                rows: [
                  { id: `row-${Date.now()}`, content: null, name: "" },
                ],
              },
            });
          },
    } as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
