import { Node } from '@tiptap/core';
export type StatusStorage = {
    autoOpen: boolean;
};
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        status: {
            setStatus: (attributes?: {
                text?: string;
                color?: string;
            }) => ReturnType;
        };
    }
    interface Storage {
        status: StatusStorage;
    }
}
export type StatusColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
export interface StatusOption {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export declare const Status: Node<StatusOption, StatusStorage>;
