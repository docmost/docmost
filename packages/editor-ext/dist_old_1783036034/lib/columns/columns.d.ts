import { Node } from "@tiptap/core";
export type ColumnsLayout = "two_equal" | "two_left_sidebar" | "two_right_sidebar" | "three_equal" | "three_left_wide" | "three_right_wide" | "three_with_sidebars" | "four_equal" | "five_equal";
export interface ColumnsOptions {
    HTMLAttributes: Record<string, any>;
}
export type WidthMode = "normal" | "wide";
export interface ColumnsAttributes {
    layout?: ColumnsLayout;
    widthMode?: WidthMode;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        columns: {
            insertColumns: (attributes?: ColumnsAttributes) => ReturnType;
            setColumnsWidthMode: (widthMode: WidthMode) => ReturnType;
            setColumnCount: (count: number) => ReturnType;
            setColumnsLayout: (layout: ColumnsLayout) => ReturnType;
        };
    }
}
export declare const Columns: Node<ColumnsOptions, any>;
