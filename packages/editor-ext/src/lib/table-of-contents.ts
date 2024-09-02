import { Node, findChildren, findParentNode, mergeAttributes, wrappingInputRule } from "@tiptap/core";
import { icon, setAttributes } from "./utils";
import { ReactNodeViewRenderer } from "@tiptap/react";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        tableOfContents: {
            setTableOfContents: () => ReturnType;
            unsetTableOfContents: () => ReturnType;
            toggleTableOfContents: () => ReturnType;
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
        return ["div", mergeAttributes({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(this.options.view);
    },

    addCommands() {
        return {
            setTableOfContents:
                () =>
                ({ commands }) => {
                    return commands.setNode(this.name);
                },

            unsetTableOfContents:
                () =>
                ({ commands }) => {
                    return commands.lift(this.name);
                },

            toggleTableOfContents:
                () =>
                ({ commands }) => {
                    return commands.toggleWrap(this.name);
                },
        };
    },

    // addInputRules() {
    //     return [
    //         wrappingInputRule({
    //             find: /^:::details\s$/,
    //             type: this.type,
    //         }),
    //     ];
    // },

    // addKeyboardShortcuts() {
    //     return {
    //         "Mod-Alt-d": () => this.editor.commands.toggleDetails(),
    //     };
    // },
});
