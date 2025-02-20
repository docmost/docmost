import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Underline } from "@tiptap/extension-underline";
import { Superscript } from "@tiptap/extension-superscript";
import SubScript from "@tiptap/extension-subscript";
import { Highlight } from "@tiptap/extension-highlight";
import { Typography } from "@tiptap/extension-typography";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Table from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import {
  Comment,
  Details,
  DetailsContent,
  DetailsSummary,
  MathBlock,
  MathInline,
  TableCell,
  TableRow,
  TrailingNode,
  TiptapImage,
  Callout,
  TiptapVideo,
  LinkExtension,
  Selection,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  Mention,
} from "@docmost/editor-ext";
import MathInlineView from "@/features/editor/components/math/math-inline.tsx";
import MathBlockView from "@/features/editor/components/math/math-block.tsx";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { Youtube } from "@tiptap/extension-youtube";
import CalloutView from "@/features/editor/components/callout/callout-view.tsx";
import CodeBlockView from "@/features/editor/components/code-block/code-block-view.tsx";
import SharedEmbedView from "@/features/editor/components/embed/shared-embed-view.tsx";
import mentionRenderItems from "@/features/editor/components/mention/mention-suggestion.ts";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Placeholder } from "@tiptap/extension-placeholder";
import { lowlight } from "@/features/editor/extensions/extensions";
import SharedMentionView from "@/features/editor/components/mention/shared-mention-view.tsx";
import SharedImageView from "@/features/editor/components/image/shared-image-view";
import SharedVideoView from "@/features/editor/components/video/shared-video-view";
import SharedAttachmentView from "@/features/editor/components/attachment/shared-attachment-view";
import SharedDrawioView from "@/features/editor/components/drawio/shared-drawio-view";
import i18n from "@/i18n.ts";
import "@/features/editor/styles/index.css";

export const readonlyEditorExtensions = [
  StarterKit.configure({
    history: false,
    dropcursor: { width: 3, color: "#70CFF8" },
    codeBlock: false,
    code: { HTMLAttributes: { spellcheck: false } },
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return i18n.t("Heading {{level}}", { level: node.attrs.level });
      }
      if (node.type.name === "detailsSummary") {
        return i18n.t("Toggle title");
      }
      if (node.type.name === "paragraph") {
        return i18n.t('Write anything. Enter "/" for commands');
      }
    },
    includeChildren: true,
    showOnlyWhenEditable: true,
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Underline,
  LinkExtension.configure({ openOnClick: false }),
  Superscript,
  SubScript,
  Highlight.configure({ multicolor: true }),
  Typography,
  TrailingNode,
  GlobalDragHandle,
  TextStyle,
  Color,
  Comment.configure({ HTMLAttributes: { class: "comment-mark" } }),
  Mention.configure({
    suggestion: {
      allowSpaces: true,
      items: () => [],
      // @ts-ignore
      render: mentionRenderItems,
    },
    HTMLAttributes: { class: "mention" },
  }).extend({ addNodeView: () => ReactNodeViewRenderer(SharedMentionView) }),
  Table.configure({
    resizable: true,
    lastColumnResizable: false,
    allowTableNodeSelection: true,
  }),
  TableRow,
  TableCell,
  TableHeader,
  MathInline.configure({ view: MathInlineView }),
  MathBlock.configure({ view: MathBlockView }),
  Details,
  DetailsSummary,
  DetailsContent,
  Youtube.configure({ addPasteHandler: false, controls: true, nocookie: true }),
  TiptapImage.configure({ view: SharedImageView, allowBase64: false }),
  TiptapVideo.configure({ view: SharedVideoView }),
  Callout.configure({ view: CalloutView }),
  CustomCodeBlock.configure({
    view: CodeBlockView,
    lowlight,
    HTMLAttributes: { spellcheck: false },
  }),
  Selection,
  Attachment.configure({ view: SharedAttachmentView }),
  Drawio.configure({ view: SharedDrawioView }),
  Excalidraw.configure({ view: SharedImageView }),
  Embed.configure({ view: SharedEmbedView }),
  CharacterCount
] as any;