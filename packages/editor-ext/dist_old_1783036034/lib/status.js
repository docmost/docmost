"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Status = void 0;
const core_1 = require("@tiptap/core");
const react_1 = require("@tiptap/react");
exports.Status = core_1.Node.create({
    name: 'status',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    addOptions() {
        return {
            HTMLAttributes: {},
            view: null,
        };
    },
    addStorage() {
        return {
            autoOpen: false,
        };
    },
    addAttributes() {
        return {
            text: {
                default: '',
                parseHTML: (element) => element.textContent || '',
            },
            color: {
                default: 'gray',
                parseHTML: (element) => element.getAttribute('data-color') || 'gray',
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
        return [
            'span',
            {
                'data-type': this.name,
                'data-color': HTMLAttributes.color,
            },
            HTMLAttributes.text,
        ];
    },
    addNodeView() {
        this.editor.isInitialized = true;
        return (0, react_1.ReactNodeViewRenderer)(this.options.view);
    },
    addCommands() {
        return {
            setStatus: (attributes) => ({ commands }) => {
                this.storage.autoOpen = true;
                return commands.insertContent({
                    type: this.name,
                    attrs: {
                        text: attributes?.text ?? '',
                        color: attributes?.color || 'gray',
                    },
                });
            },
        };
    },
});
//# sourceMappingURL=status.js.map