import { Node } from '@tiptap/pm/model';
import { isAttachmentNode } from './attachment-node-types';
export interface MentionNode {
    id: string;
    label: string;
    entityType: 'user' | 'page';
    entityId: string;
    creatorId: string;
}
export declare function extractMentions(prosemirrorJson: any): MentionNode[];
export declare function extractUserMentions(mentionList: MentionNode[]): MentionNode[];
export declare function extractPageMentions(mentionList: MentionNode[]): MentionNode[];
export declare function extractInternalLinkSlugIds(prosemirrorJson: any): string[];
export declare function extractUserMentionIdsFromJson(json: any): string[];
export declare function getProsemirrorContent(content: any): any;
export { isAttachmentNode };
export declare function getAttachmentIds(prosemirrorJson: any): any[];
export declare function removeMarkTypeFromDoc(doc: Node, markName: string): Node;
export declare function createYdocFromJson(prosemirrorJson: any): Buffer | null;
