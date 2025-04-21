import {
  BubbleMenu as BaseBubbleMenu,
  findParentNode,
  posToDOMRect,
} from '@tiptap/react';
import { useCallback } from 'react';
import { sticky } from 'tippy.js';
import { Node as PMNode } from 'prosemirror-model';
import {
  EditorMenuProps,
  ShouldShowProps,
} from '@/features/editor/components/table/types/types.ts';
import { NodeWidthResize } from '@/features/editor/components/common/node-width-resize.tsx';

export function ExcalidrawMenu({ editor }: EditorMenuProps) {
  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive('excalidraw') && editor.getAttributes('excalidraw')?.src;
    },
    [editor]
  );

  const getReferenceClientRect = useCallback(() => {
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === 'excalidraw';
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      return dom.getBoundingClientRect();
    }

    return posToDOMRect(editor.view, selection.from, selection.to);
  }, [editor]);

  const onWidthChange = useCallback(
    (value: number) => {
      editor.commands.updateAttributes('excalidraw', { width: `${value}%` });
    },
    [editor]
  );

  return (
    <BaseBubbleMenu
      editor={editor}
      pluginKey={`excalidraw-menu}`}
      updateDelay={0}
      tippyOptions={{
        getReferenceClientRect,
        offset: [0, 8],
        zIndex: 99,
        popperOptions: {
          modifiers: [{ name: 'flip', enabled: false }],
        },
        plugins: [sticky],
        sticky: 'popper',
      }}
      shouldShow={shouldShow}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {editor.getAttributes('excalidraw')?.width && (
          <NodeWidthResize
            onChange={onWidthChange}
            value={parseInt(editor.getAttributes('excalidraw').width)}
          />
        )}
      </div>
    </BaseBubbleMenu>
  );
}

export default ExcalidrawMenu;
