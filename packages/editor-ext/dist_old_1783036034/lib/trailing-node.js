"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrailingNode = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
function nodeEqualsType({ types, node }) {
    return (Array.isArray(types) && types.includes(node.type)) || node.type === types;
}
exports.TrailingNode = core_1.Extension.create({
    name: 'trailingNode',
    addOptions() {
        return {
            node: 'paragraph',
            notAfter: [
                'paragraph',
            ],
        };
    },
    addProseMirrorPlugins() {
        const plugin = new state_1.PluginKey(this.name);
        const disabledNodes = Object.entries(this.editor.schema.nodes)
            .map(([, value]) => value)
            .filter(node => this.options.notAfter.includes(node.name));
        return [
            new state_1.Plugin({
                key: plugin,
                appendTransaction: (_, __, state) => {
                    const { doc, tr, schema } = state;
                    const shouldInsertNodeAtEnd = plugin.getState(state);
                    const endPosition = doc.content.size;
                    const type = schema.nodes[this.options.node];
                    if (!shouldInsertNodeAtEnd) {
                        return;
                    }
                    return tr.insert(endPosition, type.create());
                },
                state: {
                    init: (_, state) => {
                        try {
                            const lastNode = state.tr.doc.lastChild;
                            return !nodeEqualsType({ node: lastNode, types: disabledNodes });
                        }
                        catch (err) {
                            console.log(err);
                        }
                        return true;
                    },
                    apply: (tr, value) => {
                        if (!tr.docChanged) {
                            return value;
                        }
                        if (tr.getMeta('__uniqueIDTransaction')) {
                            return value;
                        }
                        const lastNode = tr.doc.lastChild;
                        return !nodeEqualsType({ node: lastNode, types: disabledNodes });
                    },
                },
            }),
        ];
    }
});
//# sourceMappingURL=trailing-node.js.map