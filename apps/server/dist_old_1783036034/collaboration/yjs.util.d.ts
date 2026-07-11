import * as Y from 'yjs';
import { Document } from '@hocuspocus/server';
export type YjsSelection = {
    anchor: any;
    head: any;
};
export declare function setYjsMark(doc: Document, fragment: Y.XmlFragment, yjsSelection: YjsSelection, markName: string, markAttributes: Record<string, any>): void;
export declare function removeYjsMarkByAttribute(fragment: Y.XmlFragment, markName: string, attributeName: string, attributeValue: string): void;
export declare function updateYjsMarkAttribute(fragment: Y.XmlFragment, markName: string, findByAttribute: {
    name: string;
    value: string;
}, newAttributes: Record<string, any>): void;
