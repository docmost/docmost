import { Node, findChildren, findParentNode, mergeAttributes, wrappingInputRule } from "@tiptap/core";
import { icon, setAttributes } from "./utils";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        tableOfContents: {
            setTableOfContents: () => ReturnType;
            unsetTableOfContents: () => ReturnType;
            toggleTableOfContents: () => ReturnType;
            setDividerType: (type: "solid" | "dashed" | "dotted" | "none") => ReturnType;
            setTableType: (type: "Contents" | "Child Pages") => ReturnType;
            setPageIcons: (icons: boolean) => ReturnType;
        };
    }
}

export interface TableofContentsOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}

export const TableofContents = Node.create<TableofContentsOptions>({
    name: "tableOfContents",

    content: "block+",
    inline: false,
    group: "block",
    isolating: true,
    atom: true,
    defining: true,

    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
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
        return ["div", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    },

    addAttributes() {
        return {
            dividerType: {
                default: "solid",
                parseHTML: (element) => element.getAttribute("data-divider-type"),
                renderHTML: (attributes) => ({
                    "data-divider-type": attributes.dividerType,
                }),
            },
            tableType: {
                default: "Contents",
                parseHTML: (element) => element.getAttribute("data-table-type"),
                renderHTML: (attributes) => ({
                    "data-table-type": attributes.tableType,
                }),
            },
            icons: {
                default: true,
                parseHTML: (element) => element.getAttribute("data-page-icons"),
                renderHTML: (attributes) => ({
                    "data-page-icons": attributes.tableType,
                }),
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(this.options.view);
    },

    addCommands() {
        return {
            setTableOfContents:
                () =>
                ({ commands }) =>
                    commands.setNode(this.name),

            unsetTableOfContents:
                () =>
                ({ commands }) =>
                    commands.lift(this.name),

            toggleTableOfContents:
                () =>
                ({ commands }) =>
                    commands.toggleWrap(this.name),

            setDividerType:
                (type) =>
                ({ commands }) =>
                    commands.updateAttributes("tableOfContents", { dividerType: type }),

            setTableType:
                (type) =>
                ({ commands }) =>
                    commands.updateAttributes("tableOfContents", { tableType: type }),

            setPageIcons:
                (icons) =>
                ({ commands }) =>
                    commands.updateAttributes("tableOfContents", { icons: icons }),
        };
    },
});
