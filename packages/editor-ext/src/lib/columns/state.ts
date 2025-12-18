import { PluginKey, Transaction } from '@tiptap/pm/state';

export const gridResizingPluginKey = new PluginKey<GridResizeState>(
  'gridResizingPlugin',
);

export type Dragging = {
  startX: number;
  startWidth: number;
};

export class GridResizeState {
  constructor(
    public activeHandle: number,
    public dragging: Dragging | false,
  ) {}

  apply(tr: Transaction): GridResizeState {
    const action = tr.getMeta(gridResizingPluginKey);
    if (!action) return this;

    if (typeof action.setHandle === 'number') {
      return new GridResizeState(action.setHandle, false);
    }
    if (action.setDragging !== undefined) {
      return new GridResizeState(this.activeHandle, action.setDragging);
    }
    if (this.activeHandle > -1 && tr.docChanged) {
      // remap when doc changes
    }
    return this;
  }
}
