import i18n from "@/i18n.ts";
import IconDrawio from "@/components/icons/icon-drawio";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import {
  CommandProps,
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
} from "@/features/editor/components/slash-menu/types";

const templateSkeletonSlashItems: SlashMenuItemType[] = [
  {
    title: "Skeleton: Draw.io",
    description: "Mark a spot for a Draw.io diagram in this template",
    searchTerms: ["skeleton", "drawio", "diagrams", "placeholder", "template"],
    icon: IconDrawio,
    command: ({ editor, range }: CommandProps) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setTemplateSkeleton({ kind: "drawio" })
        .run(),
  },
  {
    title: "Skeleton: Excalidraw",
    description: "Mark a spot for an Excalidraw diagram in this template",
    searchTerms: [
      "skeleton",
      "excalidraw",
      "whiteboard",
      "placeholder",
      "template",
    ],
    icon: IconExcalidraw,
    command: ({ editor, range }: CommandProps) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setTemplateSkeleton({ kind: "excalidraw" })
        .run(),
  },
];

function matchesQuery(item: SlashMenuItemType, query: string): boolean {
  if (!query) return true;
  const search = query.toLowerCase();
  const translatedTitle = i18n.t(item.title).toLowerCase();
  const translatedDescription = i18n.t(item.description).toLowerCase();
  return (
    item.title.toLowerCase().includes(search) ||
    translatedTitle.includes(search) ||
    item.description.toLowerCase().includes(search) ||
    translatedDescription.includes(search) ||
    item.searchTerms?.some((term) => term.includes(search))
  );
}

export function mergeTemplateSkeletonItems(
  groups: SlashMenuGroupedItemsType,
  query: string,
): SlashMenuGroupedItemsType {
  const matchingItems = templateSkeletonSlashItems.filter((item) =>
    matchesQuery(item, query),
  );

  if (!matchingItems.length) {
    return groups;
  }

  return {
    ...groups,
    basic: [...(groups.basic ?? []), ...matchingItems],
  };
}

export default templateSkeletonSlashItems;
