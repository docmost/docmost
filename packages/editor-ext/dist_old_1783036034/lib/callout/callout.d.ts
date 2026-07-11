import { Node } from "@tiptap/core";
import { CalloutType } from "./utils";
export interface CalloutOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface CalloutAttributes {
    type: CalloutType;
    icon?: string;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (attributes?: CalloutAttributes) => ReturnType;
            unsetCallout: () => ReturnType;
            toggleCallout: (attributes?: CalloutAttributes) => ReturnType;
            updateCalloutType: (type: CalloutType) => ReturnType;
            updateCalloutIcon: (icon: string) => ReturnType;
        };
    }
}
export declare const inputRegex: RegExp;
export declare const Callout: Node<CalloutOptions, any>;
