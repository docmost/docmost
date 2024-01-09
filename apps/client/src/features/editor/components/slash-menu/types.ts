import { Editor, Range } from '@tiptap/core';

export type CommandProps = {
  editor: Editor;
  range: Range;
}

export type CommandListProps = {
  items: SlashMenuGroupedItemsType;
  command: (item: SlashMenuItemType) => void;
  editor: Editor;
  range: Range;
}

export type SlashMenuItemType = {
  title: string;
  description: string;
  icon: any;
  separator?: true;
  searchTerms: string[];
  command: (props: CommandProps) => void;
  disable?: (editor: Editor) => boolean;
}

export type SlashMenuGroupedItemsType = {
  [category: string]: SlashMenuItemType[];
};
