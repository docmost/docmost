import { Extension, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
declare module "@tiptap/core" {
    interface Storage {
        searchAndReplace: SearchAndReplaceStorage;
    }
    interface Commands<ReturnType> {
        search: {
            setSearchTerm: (searchTerm: string) => ReturnType;
            setReplaceTerm: (replaceTerm: string) => ReturnType;
            setCaseSensitive: (caseSensitive: boolean) => ReturnType;
            resetIndex: () => ReturnType;
            nextSearchResult: () => ReturnType;
            previousSearchResult: () => ReturnType;
            replace: () => ReturnType;
            replaceAll: () => ReturnType;
            selectCurrentItem: () => ReturnType;
        };
    }
}
export declare const searchAndReplacePluginKey: PluginKey<any>;
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
export declare const SearchAndReplace: Extension<SearchAndReplaceOptions, SearchAndReplaceStorage>;
export default SearchAndReplace;
