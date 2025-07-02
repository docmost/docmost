import { Editor, Range } from "@tiptap/core";
import { HeadingInfo } from "@/features/search/types/search.types";

export interface MentionListProps {
  query: string;
  command: any;
  items: [];
  range: Range;
  text: string;
  editor: Editor;
}

export type MentionSuggestionItem =
  | { entityType: "header"; label: string }
  | {
  id: string;
  label: string;
  email: string;
  entityType: "user";
  entityId: string;
  avatarUrl: string;
}
  | {
  id: string;
  label: string;
  breadcrumbs: string;
  entityType: "page";
  entityId: string;
  slugId: string;
  icon: string;
  anchorSlug?: string;
  anchorText?: string;
  headings?: HeadingInfo[];
};