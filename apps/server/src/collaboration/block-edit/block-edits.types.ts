import type { JSONContent } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type { CalloutType, StatusColor } from '@docmost/editor-ext';

export type BlockEditType =
  | 'replace'
  | 'insert_before'
  | 'insert_after'
  | 'delete'
  | 'move_before'
  | 'move_after'
  | 'move_into'
  | 'replace_text'
  | 'update_callout'
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
  calloutType?: CalloutType;
  icon?: string | null;
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

export type BlockEditResult =
  | {
      ok: true;
      insertedRefs: string[][];
      updatedCells?: UpdatedCell[];
      movedInto?: MoveDestination[];
    }
  | { ok: false; error: string };

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
      insertedRefs: string[][];
      updatedCells?: UpdatedCell[];
      movedInto?: MoveDestination[];
    }
  | { ok: false; error: string };
