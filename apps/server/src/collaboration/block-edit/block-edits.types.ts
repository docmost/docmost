import type { JSONContent } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';

export type BlockEditType =
  | 'replace'
  | 'insert_before'
  | 'insert_after'
  | 'delete'
  | 'move_before'
  | 'move_after';

export type BlockEdit = {
  type: BlockEditType;
  ref: string;
  endRef?: string;
  targetRef?: string;
  content?: JSONContent[];
};

export type BlockEditResult =
  | { ok: true; insertedRefs: string[][] }
  | { ok: false; error: string };

export type BlockSplice = {
  parentPath: number[];
  index: number;
  deleteCount: number;
  insert: Array<{ json: JSONContent } | { movedFrom: number[] }>;
};

export type BlockEditPlan =
  | { ok: true; doc: Node; splices: BlockSplice[]; insertedRefs: string[][] }
  | { ok: false; error: string };
