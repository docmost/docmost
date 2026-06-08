import { Range } from "@tiptap/core";
import { useEditor } from "@tiptap/react";

export type CommandProps = {
  editor: ReturnType<typeof useEditor>;
  range: Range;
};

export type CommandListProps = {
  items: SlashMenuGroupedItemsType;
  command: (item: SlashMenuItemType) => void;
  editor: ReturnType<typeof useEditor>;
  range: Range;
};

export type SlashMenuItemType = {
  title: string;
  description: string;
  icon: any;
  separator?: true;
  searchTerms: string[];
  command: (props: CommandProps) => void;
  disable?: (editor: ReturnType<typeof useEditor>) => boolean;
  /**
   * Hide the entry until the given third-party integration is registered
   * (i.e. its manifest is in IntegrationOAuthRegistry server-side, which
   * happens when its env config is present). Doesn't gate on the user
   * having connected — clicking the entry is the discovery + connect path.
   */
  requiresIntegration?: string;
};

export type SlashMenuGroupedItemsType = {
  [category: string]: SlashMenuItemType[];
};
