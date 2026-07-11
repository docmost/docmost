import { Transform } from "@tiptap/pm/transform";
import { Node, Schema } from "@tiptap/pm/model";
import { Operation } from "rfc6902";
import { AnyObject } from "./types";
export interface Options {
    complexSteps?: boolean;
    wordDiffs?: boolean;
    simplifyDiff?: boolean;
}
export declare class RecreateTransform {
    fromDoc: Node;
    toDoc: Node;
    complexSteps: boolean;
    wordDiffs: boolean;
    simplifyDiff: boolean;
    schema: Schema;
    tr: Transform;
    currentJSON: AnyObject;
    finalJSON: AnyObject;
    ops: Array<Operation>;
    constructor(fromDoc: Node, toDoc: Node, options?: Options);
    init(): Transform;
    recreateChangeContentSteps(): void;
    addSetNodeMarkup(): boolean;
    recreateChangeMarkSteps(): void;
    addReplaceStep(toDoc: Node, afterStepJSON: AnyObject): boolean;
    addReplaceTextSteps(op: any, afterStepJSON: any): void;
}
export declare function recreateTransform(fromDoc: Node, toDoc: Node, options?: Options): Transform;
