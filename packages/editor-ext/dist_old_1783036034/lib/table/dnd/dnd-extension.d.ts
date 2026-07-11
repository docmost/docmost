import { Editor, Extension } from "@tiptap/core";
import { PluginKey, Plugin, PluginSpec, Transaction } from "@tiptap/pm/state";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorProps } from "@tiptap/pm/view";
import { HoveringCellInfo } from "./utils";
export interface TableHandleState {
    hoveringCell: HoveringCellInfo | null;
    tableNode: ProseMirrorNode | null;
    tablePos: number | null;
    dragging: {
        orientation: "col" | "row";
        index: number;
    } | null;
    frozen: boolean;
}
export declare const TableDndKey: PluginKey<TableHandleState>;
declare class TableHandlePluginSpec implements PluginSpec<TableHandleState> {
    editor: Editor;
    key: PluginKey<TableHandleState>;
    props: EditorProps<Plugin<TableHandleState>>;
    private _previewController;
    private _dropIndicatorController;
    private _hoveringCell?;
    private _disposables;
    private _draggingDirection;
    private _draggingIndex;
    private _droppingIndex;
    private _draggingDOMs?;
    private _startCoords;
    private _dragging;
    state: {
        init: () => TableHandleState;
        apply: (tr: Transaction, prev: TableHandleState) => TableHandleState;
    };
    constructor(editor: Editor);
    view: () => {
        destroy: () => void;
    };
    destroy: () => void;
    private _pointerDown;
    private _pointerMove;
    private _onSelectionUpdate;
    private _dispatchMeta;
    startDragFromHandle: (orientation: "col" | "row", clientX: number, clientY: number) => boolean;
    updateDragPosition: (clientX: number, clientY: number) => void;
    commitDrop: () => void;
    endDrag: () => void;
}
export type { TableHandlePluginSpec };
export declare function getTableHandlePluginSpec(editor: Editor): TableHandlePluginSpec | null;
export declare const TableDndExtension: Extension<any, any>;
export declare const TableHandleCommandsExtension: Extension<any, any>;
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        tableHandleCommands: {
            freezeHandles: () => ReturnType;
            unfreezeHandles: () => ReturnType;
        };
    }
}
