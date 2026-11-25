import type { JSONContent } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type { StatusColor } from '@docmost/editor-ext';
import type { BlockRefIndex } from './block-refs';

export type BlockEditType =
  | 'replace'
  | 'insert_before'
  | 'insert_after'
  | 'delete'
  | 'move_before'
  | 'move_after'
  | 'move_into'
  | 'replace_text'
  | 'set_attrs'
  | 'update_cells'
  | 'replace_document'
  | 'append_document'
  | 'prepend_document';

export type BlockEdit = {
  type: BlockEditType;
  ref: string;
  endRef?: string;
  targetRef?: string;
  position?: 'start' | 'end';
  content?: JSONContent[];
  oldText?: string;
  newText?: string;
  occurrence?: number;
  changes?: CellEdit[];
  attrs?: Record<string, unknown>;
};

export type CellEdit = {
  column: number;
  oldValue: string;
  newValue: string;
  color?: StatusColor;
};
export type UpdatedCell = {
  rowRef: string;
  column: number;
  value: string;
  color?: StatusColor;
};

export type MoveDestination = { parentRef: string; parentType: string };

export type BlockEditChange = {
  operation: number;
  type: BlockEditType;
  refs: string[];
  attrs?: Record<string, unknown>;
  text?: string;
  textTruncated?: true;
  destination?: {
    parentType: string;
    parentRef?: string;
    targetRef?: string;
    /** One-based index of the first moved block in its saved parent. */
    index: number;
  };
};

export type BlockEditFailure = {
  ok: false;
  error: string;
  code?: string;
  operation?: number;
  column?: number;
  currentRevision?: string;
};

export type BlockEditResult =
  | {
      ok: true;
      contentRevision: string;
      changes: BlockEditChange[];
      insertedRefs: string[][];
      updatedCells?: UpdatedCell[];
      movedInto?: MoveDestination[];
    }
  | BlockEditFailure;

export type ExpectedNode = {
  path: number[];
  type: string;
  childCount?: number;
};

export type BlockSplice = {
  parentPath: number[];
  index: number;
  deleteCount: number;
  insert: Array<{ json: JSONContent } | { movedFrom: number[] }>;
  expected: ExpectedNode[];
};

export type TextSplice = {
  path: number[];
  run: number;
  before: string;
  from: number;
  to: number;
  text: string;
  marksAt: number;
  expected: ExpectedNode[];
};

export type FormatSplice = {
  path: number[];
  format: JSONContent;
  fill?: boolean;
  expected: ExpectedNode[];
};
export type AttributeSplice = {
  path: number[];
  attributes: Record<string, unknown>;
  expected: ExpectedNode[];
};
export type StatusSplice = {
  path: number[];
  atomIndex: number;
  atomTypes: string[];
  standalone: boolean;
  oldLabel: string;
  oldColor?: string;
  patch: { text?: string; color?: StatusColor };
  expected: ExpectedNode[];
};
export type EditSplice =
  | BlockSplice
  | TextSplice
  | FormatSplice
  | AttributeSplice
  | StatusSplice;

export type BlockEditPlan =
  | {
      ok: true;
      doc: Node;
      splices: EditSplice[];
      sourceRefs?: BlockRefIndex;
      resultRefs?: BlockRefIndex;
      textTargets: { edit: number; path: number[]; from: number }[];
      insertedRefs: string[][];
      updatedCells?: UpdatedCell[];
      movedInto?: MoveDestination[];
    }
  | BlockEditFailure;
