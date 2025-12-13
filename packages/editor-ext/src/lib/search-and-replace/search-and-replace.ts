/***
 MIT License
 Copyright (c) 2023 - 2024 Jeet Mandaliya (Github Username: sereneinserenade)
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 ***/

import { Extension, Range, type Dispatch } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Node as PMNode, Mark } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Storage {
    searchAndReplace: SearchAndReplaceStorage;
  }
  interface Commands<ReturnType> {
    search: {
      /**
       * @description Set search term in extension.
       */
      setSearchTerm: (searchTerm: string) => ReturnType;
      /**
       * @description Set replace term in extension.
       */
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      /**
       * @description Set case sensitivity in extension.
       */
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      /**
       * @description Reset current search result to first instance.
       */
      resetIndex: () => ReturnType;
      /**
       * @description Find next instance of search result.
       */
      nextSearchResult: () => ReturnType;
      /**
       * @description Find previous instance of search result.
       */
      previousSearchResult: () => ReturnType;
      /**
       * @description Replace first instance of search result with given replace term.
       */
      replace: () => ReturnType;
      /**
       * @description Replace all instances of search result with given replace term.
       */
      replaceAll: () => ReturnType;
      /**
       * @description Find selected instance of search result.
       */
      selectCurrentItem: () => ReturnType;
    };
  }
}

interface TextNodesWithPosition {
  text: string;
  pos: number;
}

const getRegex = (
  s: string,
  disableRegex: boolean,
  caseSensitive: boolean,
): RegExp => {
  return RegExp(
    disableRegex ? s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : s,
    caseSensitive ? "gu" : "gui",
  );
};

interface ProcessedSearches {
  decorationsToReturn: DecorationSet;
  results: Range[];
}

function processSearches(
  doc: PMNode,
  searchTerm: RegExp,
  searchResultClass: string,
  resultIndex: number,
): ProcessedSearches {
  const decorations: Decoration[] = [];
  const results: Range[] = [];

  let textNodesWithPosition: TextNodesWithPosition[] = [];
  let index = 0;

  if (!searchTerm) {
    return {
      decorationsToReturn: DecorationSet.empty,
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
      } else {
        textNodesWithPosition[index] = {
          text: `${node.text}`,
          pos,
        };
      }
    } else {
      index += 1;
    }
  });

  textNodesWithPosition = textNodesWithPosition.filter(Boolean);

  for (const element of textNodesWithPosition) {
    const { text, pos } = element;
    const matches = Array.from(text.matchAll(searchTerm)).filter(
      ([matchText]) => matchText.trim(),
    );

    for (const m of matches) {
      if (m[0] === "") break;

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
    const className =
      i === resultIndex
        ? `${searchResultClass} ${searchResultClass}-current`
        : searchResultClass;
    const decoration: Decoration = Decoration.inline(r.from, r.to, {
      class: className,
    });

    decorations.push(decoration);
  }

  return {
    decorationsToReturn: DecorationSet.create(doc, decorations),
    results,
  };
}

const replace = (
  replaceTerm: string,
  results: Range[],
  resultIndex: number,
  { state, dispatch }: { state: EditorState; dispatch: Dispatch },
) => {
  const firstResult = results[resultIndex];

  if (!firstResult) return;

  const { from, to } = results[resultIndex];

  if (dispatch) {
    const tr = state.tr;

    // Get all marks that span the text being replaced
    const marksSet = new Set<Mark>();
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks) {
        node.marks.forEach((mark) => marksSet.add(mark));
      }
    });

    const marks = Array.from(marksSet);

    // Delete the old text and insert new text with preserved marks
    tr.delete(from, to);
    tr.insert(from, state.schema.text(replaceTerm, marks));

    dispatch(tr);
  }
};

const replaceAll = (
  replaceTerm: string,
  results: Range[],
  { tr, dispatch }: { tr: Transaction; dispatch: Dispatch },
) => {
  const resultsCopy = results.slice();

  if (!resultsCopy.length) return;

  // Process replacements in reverse order to avoid position shifting issues
  for (let i = resultsCopy.length - 1; i >= 0; i -= 1) {
    const { from, to } = resultsCopy[i];

    // Get all marks that span the text being replaced
    const marksSet = new Set<Mark>();
    tr.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks) {
        node.marks.forEach((mark) => marksSet.add(mark));
      }
    });

    const marks = Array.from(marksSet);

    // Delete and insert with preserved marks
    tr.delete(from, to);
    tr.insert(from, tr.doc.type.schema.text(replaceTerm, marks));
  }

  dispatch(tr);
};

export const searchAndReplacePluginKey = new PluginKey(
  "searchAndReplacePlugin",
);

export interface SearchAndReplaceOptions {
  searchResultClass: string;
  disableRegex: boolean;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  lastSearchTerm: string;
  caseSensitive: boolean;
  lastCaseSensitive: boolean;
  resultIndex: number;
  lastResultIndex: number;
}

export const SearchAndReplace = Extension.create<
  SearchAndReplaceOptions,
  SearchAndReplaceStorage
>({
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
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.searchTerm = searchTerm;

          return false;
        },
      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.replaceTerm = replaceTerm;

          return false;
        },
      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.caseSensitive = caseSensitive;

          return false;
        },
      resetIndex:
        () =>
        ({ editor }) => {
          editor.storage.searchAndReplace.resultIndex = 0;

          return false;
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;

          const nextIndex = resultIndex + 1;

          if (results[nextIndex]) {
            editor.storage.searchAndReplace.resultIndex = nextIndex;
          } else {
            editor.storage.searchAndReplace.resultIndex = 0;
          }

          return false;
        },
      previousSearchResult:
        () =>
        ({ editor }) => {
          const { results, resultIndex } = editor.storage.searchAndReplace;

          const prevIndex = resultIndex - 1;

          if (results[prevIndex]) {
            editor.storage.searchAndReplace.resultIndex = prevIndex;
          } else {
            editor.storage.searchAndReplace.resultIndex = results.length - 1;
          }

          return false;
        },
      replace:
        () =>
        ({ editor, state, dispatch }) => {
          const { replaceTerm, results, resultIndex } =
            editor.storage.searchAndReplace;

          replace(replaceTerm, results, resultIndex, { state, dispatch });

          // After replace, adjust index if needed
          // The results will be recalculated by the plugin, but we need to ensure
          // the index doesn't exceed the new bounds
          setTimeout(() => {
            const newResultsLength =
              editor.storage.searchAndReplace.results.length;
            if (
              newResultsLength > 0 &&
              editor.storage.searchAndReplace.resultIndex >= newResultsLength
            ) {
              // Keep the same position if possible, otherwise go to the last result
              editor.storage.searchAndReplace.resultIndex = Math.min(
                resultIndex,
                newResultsLength - 1,
              );
            }
          }, 0);

          return false;
        },
      replaceAll:
        () =>
        ({ editor, tr, dispatch }) => {
          const { replaceTerm, results } = editor.storage.searchAndReplace;

          replaceAll(replaceTerm, results, { tr, dispatch });

          return false;
        },
      selectCurrentItem:
        () =>
        ({ editor }) => {
          const { results } = editor.storage.searchAndReplace;
          for (let i = 0; i < results.length; i++) {
            if (
              results[i].from == editor.state.selection.from &&
              results[i].to == editor.state.selection.to
            ) {
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

    const setLastSearchTerm = (t: string) =>
      (editor.storage.searchAndReplace.lastSearchTerm = t);
    const setLastCaseSensitive = (t: boolean) =>
      (editor.storage.searchAndReplace.lastCaseSensitive = t);
    const setLastResultIndex = (t: number) =>
      (editor.storage.searchAndReplace.lastResultIndex = t);

    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply({ doc, docChanged }, oldState) {
            const {
              searchTerm,
              lastSearchTerm,
              caseSensitive,
              lastCaseSensitive,
              resultIndex,
              lastResultIndex,
            } = editor.storage.searchAndReplace;

            if (
              !docChanged &&
              lastSearchTerm === searchTerm &&
              lastCaseSensitive === caseSensitive &&
              lastResultIndex === resultIndex
            )
              return oldState;

            setLastSearchTerm(searchTerm);
            setLastCaseSensitive(caseSensitive);
            setLastResultIndex(resultIndex);

            if (!searchTerm) {
              editor.storage.searchAndReplace.results = [];
              return DecorationSet.empty;
            }

            const { decorationsToReturn, results } = processSearches(
              doc,
              getRegex(searchTerm, disableRegex, caseSensitive),
              searchResultClass,
              resultIndex,
            );

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

export default SearchAndReplace;
