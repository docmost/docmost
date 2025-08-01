import { Node, mergeAttributes, Range } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AudioUploadPlugin } from "./audio-upload";

export interface AudioOptions {
    view: any;
    HTMLAttributes: Record<string, any>;
}

export interface AudioAttributes {
    src?: string;
    title?: string;
    attachmentId?: string;
    size?: number;
    align?: string;
    width?: number;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        audioBlock: {
            setAudio: (attributes: AudioAttributes) => ReturnType;
        };
    }
}

export const Audio = Node.create<AudioOptions>({
    name: "audio",

    group: "block",
    inline: false,
    isolating: true,
    atom: true,
    defining: true,
    draggable: true,

    addOptions() {
        return {
            view: null,
            HTMLAttributes: {},
        };
    },    addAttributes() {
        return {
            src: {
                default: "",
                parseHTML: (element) => element.getAttribute("src"),
                renderHTML: (attributes) => ({
                    src: attributes.src,
                }),
            },            
            attachmentId: {
                default: undefined,
                parseHTML: (element) => element.getAttribute("data-attachment-id"),
                renderHTML: (attributes: AudioAttributes) => ({
                    "data-attachment-id": attributes.attachmentId,
                }),
            },
            size: {
                default: null,
                parseHTML: (element) => element.getAttribute("data-size"),
                renderHTML: (attributes: AudioAttributes) => ({
                    "data-size": attributes.size,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "audio",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "audio",
            { controls: "true", ...HTMLAttributes },
            ["source", HTMLAttributes],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(this.options.view);
    },

    addProseMirrorPlugins() {
        return [
            AudioUploadPlugin({
                placeholderClass: "audio-upload",
            }),
        ];
    },
});