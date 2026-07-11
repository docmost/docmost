"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowlightPlugin = LowlightPlugin;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
const view_1 = require("@tiptap/pm/view");
const core_2 = require("highlight.js/lib/core");
function parseNodes(nodes, className = []) {
    return nodes
        .map((node) => {
        const classes = [
            ...className,
            ...(node.properties ? node.properties.className : []),
        ];
        if (node.children) {
            return parseNodes(node.children, classes);
        }
        return {
            text: node.value,
            classes,
        };
    })
        .flat();
}
function getHighlightNodes(result) {
    return result.value || result.children || [];
}
function registered(aliasOrLanguage) {
    return Boolean(core_2.default.getLanguage(aliasOrLanguage));
}
const AUTO_DETECT_SAMPLE_SIZE = 3000;
function getDecorations({ doc, name, lowlight, defaultLanguage, }) {
    const decorations = [];
    (0, core_1.findChildren)(doc, (node) => node.type.name === name).forEach((block) => {
        let from = block.pos + 1;
        const language = block.node.attrs.language || defaultLanguage;
        const languages = lowlight.listLanguages();
        const textContent = block.node.textContent;
        let nodes;
        if (language &&
            (languages.includes(language) ||
                registered(language) ||
                lowlight.registered?.(language))) {
            nodes = getHighlightNodes(lowlight.highlight(language, textContent));
        }
        else {
            const sample = textContent.length > AUTO_DETECT_SAMPLE_SIZE
                ? textContent.slice(0, AUTO_DETECT_SAMPLE_SIZE)
                : textContent;
            const autoResult = lowlight.highlightAuto(sample);
            const detectedLanguage = autoResult.data?.language;
            if (detectedLanguage && textContent.length > AUTO_DETECT_SAMPLE_SIZE) {
                nodes = getHighlightNodes(lowlight.highlight(detectedLanguage, textContent));
            }
            else {
                nodes = getHighlightNodes(autoResult);
            }
        }
        parseNodes(nodes).forEach((node) => {
            const to = from + node.text.length;
            if (node.classes.length) {
                const decoration = view_1.Decoration.inline(from, to, {
                    class: node.classes.join(' '),
                });
                decorations.push(decoration);
            }
            from = to;
        });
    });
    return view_1.DecorationSet.create(doc, decorations);
}
function isFunction(param) {
    return typeof param === 'function';
}
function LowlightPlugin({ name, lowlight, defaultLanguage, }) {
    if (!['highlight', 'highlightAuto', 'listLanguages'].every((api) => isFunction(lowlight[api]))) {
        throw Error('You should provide an instance of lowlight to use the code-block-lowlight extension');
    }
    const lowlightPlugin = new state_1.Plugin({
        key: new state_1.PluginKey('lowlight'),
        state: {
            init: (_, { doc }) => getDecorations({
                doc,
                name,
                lowlight,
                defaultLanguage,
            }),
            apply: (transaction, decorationSet, oldState, newState) => {
                const oldNodeName = oldState.selection.$head.parent.type.name;
                const newNodeName = newState.selection.$head.parent.type.name;
                const oldNodes = (0, core_1.findChildren)(oldState.doc, (node) => node.type.name === name);
                const newNodes = (0, core_1.findChildren)(newState.doc, (node) => node.type.name === name);
                if (transaction.docChanged &&
                    ([oldNodeName, newNodeName].includes(name) ||
                        newNodes.length !== oldNodes.length ||
                        transaction.steps.some((step) => {
                            return (step.from !== undefined &&
                                step.to !== undefined &&
                                oldNodes.some((node) => {
                                    return (node.pos >= step.from &&
                                        node.pos + node.node.nodeSize <= step.to);
                                }));
                        }))) {
                    return getDecorations({
                        doc: transaction.doc,
                        name,
                        lowlight,
                        defaultLanguage,
                    });
                }
                return decorationSet.map(transaction.mapping, transaction.doc);
            },
        },
        props: {
            decorations(state) {
                return lowlightPlugin.getState(state);
            },
        },
    });
    return lowlightPlugin;
}
//# sourceMappingURL=lowlight-plugin.js.map