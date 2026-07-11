"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Details = void 0;
const core_1 = require("@tiptap/core");
const utils_1 = require("../utils");
exports.Details = core_1.Node.create({
    name: "details",
    group: "block",
    content: "detailsSummary detailsContent",
    defining: true,
    isolating: true,
    allowGapCursor: false,
    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },
    addAttributes() {
        return {
            open: {
                default: false,
                parseHTML: (e) => e.getAttribute("open"),
                renderHTML: (a) => (a.open ? { open: "" } : {}),
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: "details",
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "details",
            (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes),
            0,
        ];
    },
    addNodeView() {
        return ({ node, editor, getPos }) => {
            const dom = document.createElement("div");
            const btn = document.createElement("button");
            const ico = document.createElement("div");
            const div = document.createElement("div");
            for (const [key, value] of Object.entries((0, core_1.mergeAttributes)(this.options.HTMLAttributes))) {
                if (value !== undefined && value !== null) {
                    dom.setAttribute(key, value);
                }
            }
            dom.setAttribute("data-type", this.name);
            btn.setAttribute("data-type", `${this.name}Button`);
            div.setAttribute("data-type", `${this.name}Container`);
            if (editor.isEditable) {
                if (node.attrs.open) {
                    dom.setAttribute("open", "true");
                }
                else {
                    dom.removeAttribute("open");
                }
            }
            ico.innerHTML = (0, utils_1.icon)("right-line");
            btn.addEventListener("click", () => {
                const open = !dom.hasAttribute("open");
                if (!editor.isEditable) {
                    if (open) {
                        dom.setAttribute("open", "true");
                    }
                    else {
                        dom.removeAttribute("open");
                    }
                    return;
                }
                (0, utils_1.setAttributes)(editor, getPos, { ...node.attrs, open });
            });
            btn.append(ico);
            dom.append(btn);
            dom.append(div);
            return {
                dom,
                contentDOM: div,
                update: (updatedNode) => {
                    if (updatedNode.type !== this.type) {
                        return false;
                    }
                    if (!editor.isEditable)
                        return true;
                    if (updatedNode.attrs.open) {
                        dom.setAttribute("open", "true");
                    }
                    else {
                        dom.removeAttribute("open");
                    }
                    return true;
                },
            };
        };
    },
    addCommands() {
        return {
            setDetails: () => {
                return ({ state, chain }) => {
                    const range = state.selection.$from.blockRange(state.selection.$to);
                    if (!range) {
                        return false;
                    }
                    const slice = state.doc.slice(range.start, range.end);
                    if (slice.content.firstChild.type.name === "detailsSummary")
                        return false;
                    if (!state.schema.nodes.detailsContent.contentMatch.matchFragment(slice.content)) {
                        return false;
                    }
                    return chain()
                        .insertContentAt({
                        from: range.start,
                        to: range.end,
                    }, {
                        type: this.name,
                        attrs: {
                            open: true,
                        },
                        content: [
                            {
                                type: "detailsSummary",
                            },
                            {
                                type: "detailsContent",
                                content: slice.toJSON()?.content ?? [],
                            },
                        ],
                    })
                        .setTextSelection(range.start + 2)
                        .run();
                };
            },
            unsetDetails: () => {
                return ({ state, chain }) => {
                    const parent = (0, core_1.findParentNode)((node) => node.type === this.type)(state.selection);
                    if (!parent) {
                        return false;
                    }
                    const summary = (0, core_1.findChildren)(parent.node, (node) => node.type.name === "detailsSummary");
                    const content = (0, core_1.findChildren)(parent.node, (node) => node.type.name === "detailsContent");
                    if (!summary.length || !content.length) {
                        return false;
                    }
                    const range = {
                        from: parent.pos,
                        to: parent.pos + parent.node.nodeSize,
                    };
                    const defaultType = state.doc.resolve(range.from).parent.type
                        .contentMatch.defaultType;
                    return chain()
                        .insertContentAt(range, [
                        defaultType?.create(null, summary[0].node.content).toJSON(),
                        ...(content[0].node.content.toJSON() ?? []),
                    ])
                        .setTextSelection(range.from + 1)
                        .run();
                };
            },
            toggleDetails: () => {
                return ({ state, chain }) => {
                    const node = (0, core_1.findParentNode)((node) => node.type === this.type)(state.selection);
                    if (node) {
                        return chain().unsetDetails().run();
                    }
                    else {
                        return chain().setDetails().run();
                    }
                };
            },
        };
    },
    addInputRules() {
        return [
            (0, core_1.wrappingInputRule)({
                find: /^:::details\s$/,
                type: this.type,
            }),
        ];
    },
    addKeyboardShortcuts() {
        return {
            "Mod-Alt-d": () => this.editor.commands.toggleDetails(),
        };
    },
});
//# sourceMappingURL=details.js.map