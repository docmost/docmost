"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchAndReplace = exports.searchAndReplacePluginKey = void 0;
const core_1 = require("@tiptap/core");
const view_1 = require("@tiptap/pm/view");
const state_1 = require("@tiptap/pm/state");
const getRegex = (s, disableRegex, caseSensitive) => {
    return RegExp(disableRegex ? s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : s, caseSensitive ? "gu" : "gui");
};
function processSearches(doc, searchTerm, searchResultClass, resultIndex) {
    const decorations = [];
    const results = [];
    let textNodesWithPosition = [];
    let index = 0;
    if (!searchTerm) {
        return {
            decorationsToReturn: view_1.DecorationSet.empty,
            results: [],
        };
    }
    doc?.descendants((node, pos) => {
        if (node.isText) {
            if (textNodesWithPosition[index]) {
                textNodesWithPosition[index] = {
                    text: textNodesWithPosition[index].text + node.text,
                    pos: textNodesWithPosition[index].pos,
                };
            }
            else {
                textNodesWithPosition[index] = {
                    text: `${node.text}`,
                    pos,
                };
            }
        }
        else {
            index += 1;
        }
    });
    textNodesWithPosition = textNodesWithPosition.filter(Boolean);
    for (const element of textNodesWithPosition) {
        const { text, pos } = element;
        const matches = Array.from(text.matchAll(searchTerm)).filter(([matchText]) => matchText.trim());
        for (const m of matches) {
            if (m[0] === "")
                break;
            if (m.index !== undefined) {
                results.push({
                    from: pos + m.index,
                    to: pos + m.index + m[0].length,
                });
            }
        }
    }
    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        const className = i === resultIndex
            ? `${searchResultClass} ${searchResultClass}-current`
            : searchResultClass;
        const decoration = view_1.Decoration.inline(r.from, r.to, {
            class: className,
        });
        decorations.push(decoration);
    }
    return {
        decorationsToReturn: view_1.DecorationSet.create(doc, decorations),
        results,
    };
}
const replace = (replaceTerm, results, resultIndex, { state, dispatch }) => {
    const firstResult = results[resultIndex];
    if (!firstResult)
        return;
    const { from, to } = results[resultIndex];
    if (dispatch) {
        const tr = state.tr;
        const marksSet = new Set();
        state.doc.nodesBetween(from, to, (node) => {
            if (node.isText && node.marks) {
                node.marks.forEach((mark) => marksSet.add(mark));
            }
        });
        const marks = Array.from(marksSet);
        tr.delete(from, to);
        if (replaceTerm) {
            tr.insert(from, state.schema.text(replaceTerm, marks));
        }
        dispatch(tr);
    }
};
const replaceAll = (replaceTerm, results, { tr, dispatch }) => {
    const resultsCopy = results.slice();
    if (!resultsCopy.length)
        return;
    for (let i = resultsCopy.length - 1; i >= 0; i -= 1) {
        const { from, to } = resultsCopy[i];
        const marksSet = new Set();
        tr.doc.nodesBetween(from, to, (node) => {
            if (node.isText && node.marks) {
                node.marks.forEach((mark) => marksSet.add(mark));
            }
        });
        const marks = Array.from(marksSet);
        tr.delete(from, to);
        if (replaceTerm) {
            tr.insert(from, tr.doc.type.schema.text(replaceTerm, marks));
        }
    }
    dispatch(tr);
};
exports.searchAndReplacePluginKey = new state_1.PluginKey("searchAndReplacePlugin");
exports.SearchAndReplace = core_1.Extension.create({
    name: "searchAndReplace",
    addOptions() {
        return {
            searchResultClass: "search-result",
            disableRegex: true,
        };
    },
    addStorage() {
        return {
            searchTerm: "",
            replaceTerm: "",
            results: [],
            lastSearchTerm: "",
            caseSensitive: false,
            lastCaseSensitive: false,
            resultIndex: 0,
            lastResultIndex: 0,
        };
    },
    addCommands() {
        return {
            setSearchTerm: (searchTerm) => ({ editor }) => {
                editor.storage.searchAndReplace.searchTerm = searchTerm;
                return false;
            },
            setReplaceTerm: (replaceTerm) => ({ editor }) => {
                editor.storage.searchAndReplace.replaceTerm = replaceTerm;
                return false;
            },
            setCaseSensitive: (caseSensitive) => ({ editor }) => {
                editor.storage.searchAndReplace.caseSensitive = caseSensitive;
                return false;
            },
            resetIndex: () => ({ editor }) => {
                editor.storage.searchAndReplace.resultIndex = 0;
                return false;
            },
            nextSearchResult: () => ({ editor }) => {
                const { results, resultIndex } = editor.storage.searchAndReplace;
                const nextIndex = resultIndex + 1;
                if (results[nextIndex]) {
                    editor.storage.searchAndReplace.resultIndex = nextIndex;
                }
                else {
                    editor.storage.searchAndReplace.resultIndex = 0;
                }
                return false;
            },
            previousSearchResult: () => ({ editor }) => {
                const { results, resultIndex } = editor.storage.searchAndReplace;
                const prevIndex = resultIndex - 1;
                if (results[prevIndex]) {
                    editor.storage.searchAndReplace.resultIndex = prevIndex;
                }
                else {
                    editor.storage.searchAndReplace.resultIndex = results.length - 1;
                }
                return false;
            },
            replace: () => ({ editor, state, dispatch }) => {
                const { replaceTerm, results, resultIndex } = editor.storage.searchAndReplace;
                replace(replaceTerm, results, resultIndex, { state, dispatch });
                setTimeout(() => {
                    const newResultsLength = editor.storage.searchAndReplace.results.length;
                    if (newResultsLength > 0 &&
                        editor.storage.searchAndReplace.resultIndex >= newResultsLength) {
                        editor.storage.searchAndReplace.resultIndex = Math.min(resultIndex, newResultsLength - 1);
                    }
                }, 0);
                return false;
            },
            replaceAll: () => ({ editor, tr, dispatch }) => {
                const { replaceTerm, results } = editor.storage.searchAndReplace;
                replaceAll(replaceTerm, results, { tr, dispatch });
                return false;
            },
            selectCurrentItem: () => ({ editor }) => {
                const { results } = editor.storage.searchAndReplace;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].from == editor.state.selection.from &&
                        results[i].to == editor.state.selection.to) {
                        editor.storage.searchAndReplace.resultIndex = i;
                    }
                }
                return false;
            },
        };
    },
    addProseMirrorPlugins() {
        const editor = this.editor;
        const { searchResultClass, disableRegex } = this.options;
        const setLastSearchTerm = (t) => (editor.storage.searchAndReplace.lastSearchTerm = t);
        const setLastCaseSensitive = (t) => (editor.storage.searchAndReplace.lastCaseSensitive = t);
        const setLastResultIndex = (t) => (editor.storage.searchAndReplace.lastResultIndex = t);
        return [
            new state_1.Plugin({
                key: exports.searchAndReplacePluginKey,
                state: {
                    init: () => view_1.DecorationSet.empty,
                    apply({ doc, docChanged }, oldState) {
                        const { searchTerm, lastSearchTerm, caseSensitive, lastCaseSensitive, resultIndex, lastResultIndex, } = editor.storage.searchAndReplace;
                        if (!docChanged &&
                            lastSearchTerm === searchTerm &&
                            lastCaseSensitive === caseSensitive &&
                            lastResultIndex === resultIndex)
                            return oldState;
                        setLastSearchTerm(searchTerm);
                        setLastCaseSensitive(caseSensitive);
                        setLastResultIndex(resultIndex);
                        if (!searchTerm) {
                            editor.storage.searchAndReplace.results = [];
                            return view_1.DecorationSet.empty;
                        }
                        const { decorationsToReturn, results } = processSearches(doc, getRegex(searchTerm, disableRegex, caseSensitive), searchResultClass, resultIndex);
                        editor.storage.searchAndReplace.results = results;
                        return decorationsToReturn;
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
        ];
    },
});
exports.default = exports.SearchAndReplace;
//# sourceMappingURL=search-and-replace.js.map