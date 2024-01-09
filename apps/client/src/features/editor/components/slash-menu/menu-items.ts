import {
  IconBlockquote,
  IconCheckbox, IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers, IconPhoto,
  IconTypography,
} from '@tabler/icons-react';
import { CommandProps, SlashMenuGroupedItemsType } from '@/features/editor/components/slash-menu/types';

const CommandGroups: SlashMenuGroupedItemsType = {
  basic: [
    {
      title: 'Text',
      description: 'Just start typing with plain text.',
      searchTerms: ['p', 'paragraph'],
      icon: IconTypography,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .run();
      },
    },
    {
      title: 'To-do List',
      description: 'Track tasks with a to-do list.',
      searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
      icon: IconCheckbox,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Heading 1',
      description: 'Big section heading.',
      searchTerms: ['title', 'big', 'large'],
      icon: IconH1,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      searchTerms: ['subtitle', 'medium'],
      icon: IconH2,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      searchTerms: ['subtitle', 'small'],
      icon: IconH3,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bullet list.',
      searchTerms: ['unordered', 'point'],
      icon: IconList,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Create a list with numbering.',
      searchTerms: ['ordered'],
      icon: IconListNumbers,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quote.',
      searchTerms: ['blockquote', 'quotes'],
      icon: IconBlockquote,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .toggleBlockquote()
          .run(),
    },
    {
      title: 'Code',
      description: 'Capture a code snippet.',
      searchTerms: ['codeblock'],
      icon: IconCode,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: 'Image',
      description: 'Upload an image from your computer.',
      searchTerms: ['photo', 'picture', 'media'],
      icon: IconPhoto,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).run();
        // upload image
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
          if (input.files?.length) {
            const file = input.files[0];
            const pos = editor.view.state.selection.from;
            //startImageUpload(file, editor.view, pos);
          }
        };
        input.click();
      },
    },
  ],
};

export const getSuggestionItems = ({ query }: { query: string }): SlashMenuGroupedItemsType => {
  const search = query.toLowerCase();
  const filteredGroups: SlashMenuGroupedItemsType = {};

  for (const [group, items] of Object.entries(CommandGroups)) {
    const filteredItems = items.filter((item) => {
      return item.title.toLowerCase().includes(search)
        || item.description.toLowerCase().includes(search)
        || (item.searchTerms && item.searchTerms.some((term: string) => term.includes(search)));
    });

    if (filteredItems.length) {
      filteredGroups[group] = filteredItems;
    }
  }

  return filteredGroups;
};

export default getSuggestionItems;
