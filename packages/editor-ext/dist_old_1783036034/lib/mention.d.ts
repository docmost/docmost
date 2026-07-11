import { Node } from "@tiptap/core";
import { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import { SuggestionOptions } from "@tiptap/suggestion";
export interface MentionNodeAttrs {
    id: string | null;
    label?: string | null;
    entityType: "user" | "page";
    entityId?: string | null;
    slugId?: string | null;
    creatorId?: string;
    anchorId?: string;
}
export type MentionOptions<SuggestionItem = any, Attrs extends Record<string, any> = MentionNodeAttrs> = {
    HTMLAttributes: Record<string, any>;
    renderText: (props: {
        options: MentionOptions<SuggestionItem, Attrs>;
        node: ProseMirrorNode;
    }) => string;
    renderHTML: (props: {
        options: MentionOptions<SuggestionItem, Attrs>;
        node: ProseMirrorNode;
    }) => DOMOutputSpec;
    deleteTriggerWithBackspace: boolean;
    suggestion: Omit<SuggestionOptions<SuggestionItem, Attrs>, "editor">;
};
export declare const MentionPluginKey: PluginKey<any>;
export declare const Mention: Node<MentionOptions<any, MentionNodeAttrs>, any>;
