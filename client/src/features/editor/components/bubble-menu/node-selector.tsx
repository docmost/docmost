import { Editor } from '@tiptap/core';
import { Dispatch, FC, SetStateAction } from 'react';
import {
  IconBlockquote,
  IconCheck, IconCheckbox, IconChevronDown, IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconTypography,
} from '@tabler/icons-react';
import { Popover, Button, rem, ScrollArea } from '@mantine/core';
import classes from '@/features/editor/components/bubble-menu/bubble-menu.module.css';

interface NodeSelectorProps {
  editor: Editor;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export interface BubbleMenuItem {
  name: string;
  icon: FC;
  command: () => void;
  isActive: () => boolean;
}

export const NodeSelector: FC<NodeSelectorProps> =
  ({ editor, isOpen, setIsOpen }) => {

    const items: BubbleMenuItem[] = [
      {
        name: 'Text',
        icon: IconTypography,
        command: () =>
          editor.chain().focus().toggleNode('paragraph', 'paragraph').run(),
        isActive: () =>
          editor.isActive('paragraph') &&
          !editor.isActive('bulletList') &&
          !editor.isActive('orderedList'),
      },
      {
        name: 'Heading 1',
        icon: IconH1,
        command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
      },
      {
        name: 'Heading 2',
        icon: IconH2,
        command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
      },
      {
        name: 'Heading 3',
        icon: IconH3,
        command: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
      },
      {
        name: 'To-do List',
        icon: IconCheckbox,
        command: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskItem'),
      },
      {
        name: 'Bullet List',
        icon: IconList,
        command: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        name: 'Numbered List',
        icon: IconListNumbers,
        command: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
      },
      {
        name: 'Blockquote',
        icon: IconBlockquote,
        command: () =>
          editor
            .chain()
            .focus()
            .toggleNode('paragraph', 'paragraph')
            .toggleBlockquote()
            .run(),
        isActive: () => editor.isActive('blockquote'),
      },
      {
        name: 'Code',
        icon: IconCode,
        command: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive('codeBlock'),
      },
    ];

    const activeItem = items.filter((item) => item.isActive()).pop() ?? {
      name: 'Multiple',
    };

    return (
      <Popover opened={isOpen} withArrow>

        <Popover.Target>
          <Button variant="default" radius="0"
                  rightSection={<IconChevronDown size={16} />}
                  className={classes.colorButton}
                  onClick={() => setIsOpen(!isOpen)}
          >
            {activeItem?.name}
          </Button>

        </Popover.Target>

        <Popover.Dropdown>
          <ScrollArea.Autosize type="scroll" mah={400}>

            <Button.Group orientation="vertical">

              {items.map((item, index) => (

                <Button
                  key={index}
                  variant="default"
                  leftSection={<item.icon size={16} />}
                  rightSection={activeItem.name === item.name
                    && (<IconCheck style={{ width: rem(16) }} />)}
                  justify="left"
                  fullWidth
                  onClick={() => {
                    item.command();
                    setIsOpen(false);
                  }}
                  style={{ border: 'none' }}
                >
                  {item.name}
                </Button>
              ))}

            </Button.Group>
          </ScrollArea.Autosize>

        </Popover.Dropdown>
      </Popover>
    );
  };
