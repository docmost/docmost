"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageBreak = void 0;
const core_1 = require("@tiptap/core");
exports.PageBreak = core_1.Node.create({
    name: "pageBreak",
    group: "block",
    atom: true,
    selectable: true,
    addOptions() {
        return {
            HTMLAttributes: {},
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
            (0, core_1.mergeAttributes)({ "data-type": this.name, class: "page-break" }, this.options.HTMLAttributes, HTMLAttributes),
        ];
    },
    addCommands() {
        return {
            setPageBreak: () => ({ chain }) => chain()
                .insertContent({ type: this.name })
                .focus()
                .run(),
        };
    },
});
//# sourceMappingURL=page-break.js.map