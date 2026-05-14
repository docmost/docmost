import { markInputRule } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Code } from "@tiptap/extension-code";
import { TextAlign } from "@tiptap/extension-text-align";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { Superscript } from "@tiptap/extension-superscript";
import SubScript from "@tiptap/extension-subscript";
import { Typography } from "@tiptap/extension-typography";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Youtube } from "@tiptap/extension-youtube";
import SlashCommand, {
  SlashCommandExtension as Command,
} from "@/features/editor/extensions/slash-command";
import renderItems from "@/features/editor/components/slash-menu/render-items";
import getSuggestionItems from "@/features/editor/components/slash-menu/menu-items";
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  Comment,
  Details,
  DetailsContent,
  DetailsSummary,
  MathBlock,
  MathInline,
  TableCell,
  TableRow,
  TableHeader,
  CustomTable,
  TrailingNode,
  TiptapImage,
  Callout,
  TiptapVideo,
  TiptapAudio,
  LinkExtension,
  Selection,
  Attachment,
  CustomCodeBlock,
  Drawio,
  Excalidraw,
  Embed,
  TiptapPdf,
  PageBreak,
  SearchAndReplace,
  Mention,
  TableDndExtension,
  TableHandleCommandsExtension,
  TableHeaderPin,
  TableReadonlySort,
  Subpages,
  Heading,
  Highlight,
  Indent,
  UniqueID,
  SharedStorage,
  Columns,
  Column,
  Status,
  TransclusionSource,
  TransclusionReference,
  TableView,
} from "@docmost/editor-ext";
import {
  randomElement,
  userColors,
} from "@/features/editor/extensions/utils.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import {
  createImageHandle,
  imageResizeClasses,
} from "@/features/editor/components/image/image-resize-handles.ts";
import {
  createResizeHandle,
  buildResizeClasses,
} from "@/features/editor/components/common/node-resize-handles.ts";
import MathInlineView from "@/features/editor/components/math/math-inline.tsx";
import MathBlockView from "@/features/editor/components/math/math-block.tsx";
import ImageView from "@/features/editor/components/image/image-view.tsx";
import CalloutView from "@/features/editor/components/callout/callout-view.tsx";
import StatusView from "@/features/editor/components/status/status-view.tsx";
import VideoView from "@/features/editor/components/video/video-view.tsx";
import AudioView from "@/features/editor/components/audio/audio-view.tsx";
import AttachmentView from "@/features/editor/components/attachment/attachment-view.tsx";
import CodeBlockView from "@/features/editor/components/code-block/code-block-view.tsx";
import DrawioView from "../components/drawio/drawio-view";
import ExcalidrawView from "@/features/editor/components/excalidraw/excalidraw-view.tsx";
import EmbedView from "@/features/editor/components/embed/embed-view.tsx";
import PdfView from "@/features/editor/components/pdf/pdf-view.tsx";
import SubpagesView from "@/features/editor/components/subpages/subpages-view.tsx";
import TransclusionView from "@/features/editor/components/transclusion/transclusion-view.tsx";
import TransclusionReferenceView from "@/features/editor/components/transclusion/transclusion-reference-view.tsx";
import { common, createLowlight } from "lowlight";
import plaintext from "highlight.js/lib/languages/plaintext";
import powershell from "highlight.js/lib/languages/powershell";
import abap from "highlightjs-sap-abap";
import elixir from "highlight.js/lib/languages/elixir";
import erlang from "highlight.js/lib/languages/erlang";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import clojure from "highlight.js/lib/languages/clojure";
import fortran from "highlight.js/lib/languages/fortran";
import haskell from "highlight.js/lib/languages/haskell";
import scala from "highlight.js/lib/languages/scala";
import mentionRenderItems from "@/features/editor/components/mention/mention-suggestion.ts";
import { ReactNodeViewRenderer, ReactMarkViewRenderer } from "@tiptap/react";
import MentionView from "@/features/editor/components/mention/mention-view.tsx";
import LinkView from "@/features/editor/components/link/link-view.tsx";
import i18n from "@/i18n.ts";
import { MarkdownClipboard } from "@/features/editor/extensions/markdown-clipboard.ts";
import EmojiCommand from "./emoji-command";
import { countWords } from "alfaaz";
import AutoJoiner from "@/features/editor/extensions/autojoiner.ts";
import GlobalDragHandle from "@/features/editor/extensions/drag-handle.ts";

const lowlight = createLowlight(common);
lowlight.register("mermaid", plaintext);
lowlight.register("powershell", powershell);
lowlight.register("abap", abap);
lowlight.register("erlang", erlang);
lowlight.register("elixir", elixir);
lowlight.register("dockerfile", dockerfile);
lowlight.register("clojure", clojure);
lowlight.register("fortran", fortran);
lowlight.register("haskell", haskell);
lowlight.register("scala", scala);

// @ts-ignore
export const mainExtensions = [
  StarterKit.configure({
    heading: false,
    undoRedo: false,
    link: false,
    trailingNode: false,
    dropcursor: {
      width: 3,
      color: "#70CFF8",
    },
    codeBlock: false,
    code: false,
  }),
  // Override TipTap's Code extension to fix the inline code input rule.
  // The upstream regex /(^|[^`])`([^`]+)`(?!`)$/ captures the character
  // before the opening backtick as part of the match, causing markInputRule
  // to delete it. Using a lookbehind avoids including it in the match.
  Code.configure({
    HTMLAttributes: {
      spellcheck: false,
    },
  }).extend({
    addInputRules() {
      return [
        markInputRule({
          find: /(?:^|(?<=[^`]))`([^`]+)`(?!`)$/,
          type: this.type,
        }),
      ];
    },
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => {
          const { from, to } = editor.state.selection;
          if (from !== to) return false;
          if (!editor.isActive("code")) return false;

          const $from = editor.state.doc.resolve(from);
          const codeType = editor.state.schema.marks.code;
          const nodeAfter = $from.nodeAfter;

          if (nodeAfter && codeType.isInSet(nodeAfter.marks)) {
            return false;
          }

          return editor.chain().unsetCode().splitBlock().run();
        },
      };
    },
  }),
  SharedStorage,
  Heading,
  UniqueID.configure({
    types: ["heading", "paragraph", "transclusionSource"],
    filterTransaction: (transaction) => !isChangeOrigin(transaction),
  }),
  Placeholder.configure({
    placeholder: ({ editor, node, pos }) => {
      if (node.type.name === "heading") {
        return i18n.t("Heading {{level}}", { level: node.attrs.level });
      }
      if (node.type.name === "detailsSummary") {
        return i18n.t("Toggle title");
      }
      if (node.type.name === "paragraph") {
        const $pos = editor.state.doc.resolve(pos);
        const parentName = $pos.parent.type.name;
        if (
          parentName === "column" ||
          parentName === "tableCell" ||
          parentName === "tableHeader" ||
          parentName === "callout" ||
          parentName === "blockquote"
        ) {
          return i18n.t("Write...");
        }
        return i18n.t('Write anything. Enter "/" for commands');
      }
    },
    includeChildren: true,
    showOnlyWhenEditable: true,
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Indent,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  LinkExtension.configure({
    openOnClick: false,
  }).extend({
    addMarkView() {
      return ReactMarkViewRenderer(LinkView);
    },
  }),
  Superscript,
  SubScript,
  Highlight.configure({
    multicolor: true,
  }),
  Typography,
  TrailingNode,
  GlobalDragHandle.configure({
    customNodes: ["transclusionSource", "transclusionReference"],
  }),
  TextStyle,
  Color,
  SlashCommand,
  EmojiCommand,
  Comment.configure({
    HTMLAttributes: {
      class: "comment-mark",
    },
  }),
  Mention.configure({
    suggestion: {
      allowSpaces: true,
      items: () => {
        return [];
      },
      // @ts-ignore
      render: mentionRenderItems,
    },
    HTMLAttributes: {
      class: "mention",
    },
  }).extend({
    addNodeView() {
      // Force the react node view to render immediately using flush sync (https://github.com/ueberdosis/tiptap/blob/b4db352f839e1d82f9add6ee7fb45561336286d8/packages/react/src/ReactRenderer.tsx#L183-L191)
      this.editor.isInitialized = true;

      return ReactNodeViewRenderer(MentionView);
    },
  }),
  CustomTable.configure({
    resizable: true,
    lastColumnResizable: true,
    allowTableNodeSelection: true,
    cellMinWidth: 49,
    View: TableView,
  }),
  TableRow,
  TableCell,
  TableHeader,
  TableDndExtension,
  TableHandleCommandsExtension,
  TableHeaderPin,
  TableReadonlySort,
  MathInline.configure({
    view: MathInlineView,
  }),
  MathBlock.configure({
    view: MathBlockView,
  }),
  Details,
  DetailsSummary,
  DetailsContent,
  Youtube.configure({
    addPasteHandler: false,
    controls: true,
    nocookie: true,
  }),
  TiptapImage.configure({
    view: ImageView,
    allowBase64: false,
    resize: {
      enabled: true,
      directions: ["left", "right"],
      minWidth: 24,
      minHeight: 16,
      alwaysPreserveAspectRatio: true,
      //@ts-ignore
      createCustomHandle: createImageHandle,
      className: imageResizeClasses,
    },
  }),
  TiptapVideo.configure({
    view: VideoView,
    resize: {
      enabled: true,
      directions: ["left", "right"],
      minWidth: 24,
      minHeight: 16,
      alwaysPreserveAspectRatio: true,
      //@ts-ignore
      createCustomHandle: createResizeHandle,
      className: buildResizeClasses("node-video"),
    },
  }),
  TiptapAudio.configure({
    view: AudioView,
  }),
  Callout.configure({
    view: CalloutView,
  }),
  CustomCodeBlock.configure({
    view: CodeBlockView,
    //@ts-ignore
    lowlight,
    enableTabIndentation: true,
    tabSize: 2,
    HTMLAttributes: {
      spellcheck: false,
    },
  }),
  Selection,
  Attachment.configure({
    view: AttachmentView,
  }),
  Drawio.configure({
    view: DrawioView,
    resize: {
      enabled: true,
      directions: ["left", "right"],
      minWidth: 24,
      minHeight: 16,
      alwaysPreserveAspectRatio: true,
      //@ts-ignore
      createCustomHandle: createResizeHandle,
      className: buildResizeClasses("node-drawio"),
    },
  }),
  Excalidraw.configure({
    view: ExcalidrawView,
    resize: {
      enabled: true,
      directions: ["left", "right"],
      minWidth: 24,
      minHeight: 16,
      alwaysPreserveAspectRatio: true,
      //@ts-ignore
      createCustomHandle: createResizeHandle,
      className: buildResizeClasses("node-excalidraw"),
    },
  }),
  Embed.configure({
    view: EmbedView,
  }),
  TiptapPdf.configure({
    view: PdfView,
  }),
  PageBreak,
  Subpages.configure({
    view: SubpagesView,
  }),
  Status.configure({
    view: StatusView,
  }),
  TransclusionSource.configure({
    view: TransclusionView,
  }),
  TransclusionReference.configure({
    view: TransclusionReferenceView,
  }),
  MarkdownClipboard.configure({
    transformPastedText: true,
  }),
  CharacterCount.configure({
    wordCounter: (text) => countWords(text),
  }),
  SearchAndReplace.extend({
    addKeyboardShortcuts() {
      return {
        "Mod-f": () => {
          const event = new CustomEvent("openFindDialogFromEditor", {});
          document.dispatchEvent(event);
          return true;
        },
        Escape: () => {
          const event = new CustomEvent("closeFindDialogFromEditor", {});
          document.dispatchEvent(event);
          return false;
        },
      };
    },
  }).configure(),
  Columns,
  Column,
  AutoJoiner.configure({
    elementsToJoin: [],
  }),
] as any;

type CollabExtensions = (provider: HocuspocusProvider, user: IUser) => any[];

const TEMPLATE_EXCLUDED_SLASH_ITEMS = new Set([
  "Image",
  "Video",
  "File attachment",
  "Draw.io (diagrams.net)",
  "Excalidraw diagram",
]);

const TemplateSlashCommand = Command.configure({
  suggestion: {
    items: ({ query }: { query: string }) =>
      getSuggestionItems({
        query,
        excludeItems: TEMPLATE_EXCLUDED_SLASH_ITEMS,
      }),
    render: renderItems,
  },
});

export const templateExtensions = [
  ...mainExtensions.filter((ext: any) => ext !== SlashCommand),
  TemplateSlashCommand,
] as any;

export const collabExtensions: CollabExtensions = (provider, user) => [
  Collaboration.configure({
    document: provider.document,
    provider,
  }),
  CollaborationCaret.configure({
    provider,
    user: {
      name: user.name,
      color: randomElement(userColors),
    },
  }),
];
