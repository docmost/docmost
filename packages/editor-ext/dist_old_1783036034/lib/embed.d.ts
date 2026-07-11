import { Node } from "@tiptap/core";
export interface EmbedOptions {
    HTMLAttributes: Record<string, any>;
    view: any;
}
export interface EmbedAttributes {
    src?: string;
    provider: string;
    align?: string;
    width?: number;
    height?: number;
}
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        embeds: {
            setEmbed: (attributes?: EmbedAttributes) => ReturnType;
        };
    }
}
export declare const Embed: Node<EmbedOptions, any>;
