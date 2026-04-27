import {
  IconBlockquote,
  IconCaretRightFilled,
  IconCheckbox,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconInfoCircle,
  IconList,
  IconListNumbers,
  IconMath,
  IconMathFunction,
  IconMovie,
  IconMusic,
  IconPaperclip,
  IconFileTypePdf,
  IconPhoto,
  IconTable,
  IconTypography,
  IconMenu4,
  IconCalendar,
  IconAppWindow,
  IconSitemap,
  IconColumns3,
  IconColumns2,
  IconTag,
} from "@tabler/icons-react";
import {
  CommandProps,
  SlashMenuGroupedItemsType,
} from "@/features/editor/components/slash-menu/types";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAudioAction } from "@/features/editor/components/audio/upload-audio-action.tsx";
import { uploadAttachmentAction } from "@/features/editor/components/attachment/upload-attachment-action.tsx";
import { uploadPdfAction } from "@/features/editor/components/pdf/upload-pdf-action.tsx";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import IconMermaid from "@/components/icons/icon-mermaid";
import IconDrawio from "@/components/icons/icon-drawio";
import { IconColumns4 } from "@/components/icons/icon-columns-4";
import { IconColumns5 } from "@/components/icons/icon-columns-5";
import {
  AirtableIcon,
  FigmaIcon,
  FramerIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  LoomIcon,
  MiroIcon,
  TypeformIcon,
  VimeoIcon,
  YoutubeIcon,
} from "@/components/icons";
import api from "@/lib/api-client";
import { notifications } from "@mantine/notifications";
import type { Editor } from "@tiptap/core";
import type { InfiniteData } from "@tanstack/react-query";
import { queryClient } from "@/main";
import type {
  IBase,
  IBaseRow,
} from "@/features/base/types/base.types";
import type { IPagination } from "@/lib/types";

// Resolve the position of a baseEmbed placeholder by its pendingKey.
// Used by the Database slash command to patch in the real pageId once
// the create-base API responds — positions may have shifted in the
// interim from collab edits, undo/redo, or concurrent slash commands.
function findBaseEmbedPlaceholderPos(
  editor: Editor,
  pendingKey: string,
): number | null {
  let foundPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (
      node.type.name === "baseEmbed" &&
      node.attrs.pendingKey === pendingKey
    ) {
      foundPos = pos;
      return false;
    }
    return true;
  });
  return foundPos;
}

const CommandGroups: SlashMenuGroupedItemsType = {
  basic: [
    {
      title: "Text",
      description: "Just start typing with plain text.",
      searchTerms: ["p", "paragraph"],
      icon: IconTypography,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode("paragraph", "paragraph")
          .run();
      },
    },
    {
      title: "To-do list",
      description: "Track tasks with a to-do list.",
      searchTerms: ["todo", "task", "list", "check", "checkbox"],
      icon: IconCheckbox,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "Heading 1",
      description: "Big section heading.",
      searchTerms: ["title", "big", "large"],
      icon: IconH1,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading.",
      searchTerms: ["subtitle", "medium"],
      icon: IconH2,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading.",
      searchTerms: ["subtitle", "small"],
      icon: IconH3,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "Bullet list",
      description: "Create a simple bullet list.",
      searchTerms: ["unordered", "point", "list"],
      icon: IconList,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered list",
      description: "Create a list with numbering.",
      searchTerms: ["numbered", "ordered", "list"],
      icon: IconListNumbers,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Quote",
      description: "Create block quote.",
      searchTerms: ["blockquote", "quotes"],
      icon: IconBlockquote,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Code",
      description: "Insert code snippet.",
      searchTerms: ["codeblock"],
      icon: IconCode,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: "Divider",
      description: "Insert horizontal rule divider",
      searchTerms: ["horizontal rule", "hr"],
      icon: IconMenu4,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Image",
      description: "Upload any image from your device.",
      searchTerms: ["photo", "picture", "media", "file", "attachment"],
      icon: IconPhoto,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload image
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadImageAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Video",
      description: "Upload any video from your device.",
      searchTerms: ["video", "mp4", "media", "file", "attachment"],
      icon: IconMovie,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload video
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadVideoAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Audio",
      description: "Upload any audio from your device.",
      searchTerms: ["audio", "music", "sound", "mp3", "media", "file", "attachment"],
      icon: IconMusic,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload audio
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadAudioAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Embed PDF",
      description: "Upload and embed a PDF file.",
      searchTerms: ["pdf", "document", "embed"],
      icon: IconFileTypePdf,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf";
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadPdfAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "File attachment",
      description: "Upload any file from your device.",
      searchTerms: ["file", "attachment", "upload", "csv", "zip"],
      icon: IconPaperclip,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload file
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadAttachmentAction(file, editor, pos, pageId, true);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Table",
      description: "Insert a table.",
      searchTerms: ["table", "rows", "columns"],
      icon: IconTable,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      title: "Toggle block",
      description: "Insert collapsible block.",
      searchTerms: ["collapsible", "block", "toggle", "details", "expand"],
      icon: IconCaretRightFilled,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setDetails().run(),
    },
    {
      title: "Callout",
      description: "Insert callout notice.",
      searchTerms: [
        "callout",
        "notice",
        "panel",
        "info",
        "warning",
        "success",
        "error",
        "danger",
      ],
      icon: IconInfoCircle,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCallout().run(),
    },
    {
      title: "Math inline",
      description: "Insert inline math equation.",
      searchTerms: [
        "math",
        "inline",
        "mathinline",
        "inlinemath",
        "inline math",
        "equation",
        "katex",
        "latex",
        "tex",
      ],
      icon: IconMathFunction,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setMathInline()
          .setNodeSelection(range.from)
          .run(),
    },
    {
      title: "Math block",
      description: "Insert math equation",
      searchTerms: [
        "math",
        "block",
        "mathblock",
        "block math",
        "equation",
        "katex",
        "latex",
        "tex",
      ],
      icon: IconMath,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setMathBlock().run(),
    },
    {
      title: "Mermaid diagram",
      description: "Insert mermaid diagram",
      searchTerms: ["mermaid", "diagrams", "chart", "uml"],
      icon: IconMermaid,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setCodeBlock({ language: "mermaid" })
          .insertContent("flowchart LR\n" + "    A --> B")
          .run(),
    },
    {
      title: "Draw.io (diagrams.net)",
      description: "Insert and design Drawio diagrams",
      searchTerms: ["drawio", "diagrams", "charts", "uml", "whiteboard"],
      icon: IconDrawio,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setDrawio().run(),
    },
    {
      title: "Excalidraw (Whiteboard)",
      description: "Draw and sketch excalidraw diagrams",
      searchTerms: ["diagrams", "draw", "sketch", "whiteboard"],
      icon: IconExcalidraw,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setExcalidraw().run(),
    },
    {
      title: "Date",
      description: "Insert current date",
      searchTerms: ["date", "today"],
      icon: IconCalendar,
      command: ({ editor, range }: CommandProps) => {
        const currentDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(currentDate)
          .run();
      },
    },
    {
      title: "Status",
      description: "Insert inline status badge.",
      searchTerms: ["status", "badge", "label", "lozenge"],
      icon: IconTag,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setStatus({ text: "", color: "gray" })
          .run();
      },
    },
    {
      title: "Subpages (Child pages)",
      description: "List all subpages of the current page",
      searchTerms: ["subpages", "child", "children", "nested", "hierarchy"],
      icon: IconSitemap,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).insertSubpages().run();
      },
    },
    {
      title: "Database",
      description: "Insert an inline database on this page",
      searchTerms: ["database", "base", "table", "grid", "spreadsheet"],
      icon: IconTable,
      command: async ({ editor, range }: CommandProps) => {
        // @ts-ignore
        const parentPageId = editor.storage?.pageId as string | undefined;
        if (!parentPageId) return;

        // Insert a placeholder embed at the slash position synchronously
        // so (a) the position is established before any focus/selection
        // drift during the await, and (b) the user sees a skeleton in
        // the document instead of an empty gap. The API call then patches
        // the real pageId into this exact node, identified by pendingKey.
        const pendingKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertBaseEmbed({ pageId: null, pendingKey })
          .run();

        try {
          // The create endpoint returns the full base (properties +
          // views), not just an id — see base.service.ts `create`. Type
          // it as IBase so we can seed the React Query cache below.
          const res = await api.post<IBase>("/bases/inline-embed", {
            parentPageId,
          });

          // Seed the caches BaseTable will read on mount so it doesn't
          // render its own (10-row) skeleton between our placeholder
          // and the actual content. Without this seeding the wrapper
          // would grow to ~436px during BaseTable's load and shrink to
          // ~112px once the rows resolve — on a short doc the shrink
          // pushes scrollY past the new doc bottom and the browser
          // clamps to 0, which is the "jump to top" the user reported.
          queryClient.setQueryData<IBase>(["bases", res.data.id], res.data);
          queryClient.setQueryData<InfiniteData<IPagination<IBaseRow>>>(
            ["base-rows", res.data.id, undefined, undefined, undefined],
            {
              pages: [
                {
                  items: [],
                  meta: {
                    limit: 100,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextCursor: null,
                    prevCursor: null,
                  },
                },
              ],
              pageParams: [undefined],
            },
          );

          const pos = findBaseEmbedPlaceholderPos(editor, pendingKey);
          if (pos === null) return;
          editor
            .chain()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                pageId: res.data.id,
                pendingKey: null,
              });
              return true;
            })
            .run();
        } catch {
          const pos = findBaseEmbedPlaceholderPos(editor, pendingKey);
          if (pos !== null) {
            editor
              .chain()
              .command(({ tr }) => {
                const node = tr.doc.nodeAt(pos);
                if (node) tr.delete(pos, pos + node.nodeSize);
                return true;
              })
              .run();
          }
          notifications.show({
            message: "Failed to create database",
            color: "red",
          });
        }
      },
    },
    {
      title: "2 Columns",
      description: "Split content into two columns.",
      searchTerms: ["columns", "layout", "split", "side"],
      icon: IconColumns2,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "two_equal" })
          .run(),
    },
    {
      title: "3 Columns",
      description: "Split content into three columns.",
      searchTerms: ["columns", "layout", "split", "triple"],
      icon: IconColumns3,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "three_equal" })
          .run(),
    },
    {
      title: "4 Columns",
      description: "Split content into four columns.",
      searchTerms: ["columns", "layout", "split"],
      icon: IconColumns4,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "four_equal" })
          .run(),
    },
    {
      title: "5 Columns",
      description: "Split content into five columns.",
      searchTerms: ["columns", "layout", "split"],
      icon: IconColumns5,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "five_equal" })
          .run(),
    },
    {
      title: "Iframe embed",
      description: "Embed any Iframe",
      searchTerms: ["iframe"],
      icon: IconAppWindow,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "iframe" })
          .run();
      },
    },
    {
      title: "Airtable",
      description: "Embed Airtable",
      searchTerms: ["airtable"],
      icon: AirtableIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "airtable" })
          .run();
      },
    },
    {
      title: "Loom",
      description: "Embed Loom video",
      searchTerms: ["loom"],
      icon: LoomIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "loom" })
          .run();
      },
    },
    {
      title: "Figma",
      description: "Embed Figma files",
      searchTerms: ["figma"],
      icon: FigmaIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "figma" })
          .run();
      },
    },
    {
      title: "Typeform",
      description: "Embed Typeform",
      searchTerms: ["typeform"],
      icon: TypeformIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "typeform" })
          .run();
      },
    },
    {
      title: "Miro",
      description: "Embed Miro board",
      searchTerms: ["miro"],
      icon: MiroIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "miro" })
          .run();
      },
    },
    {
      title: "YouTube",
      description: "Embed YouTube video",
      searchTerms: ["youtube", "yt", "media", "video"],
      icon: YoutubeIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "youtube" })
          .run();
      },
    },
    {
      title: "Vimeo",
      description: "Embed Vimeo video",
      searchTerms: ["vimeo"],
      icon: VimeoIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "vimeo" })
          .run();
      },
    },
    {
      title: "Framer",
      description: "Embed Framer prototype",
      searchTerms: ["framer"],
      icon: FramerIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "framer" })
          .run();
      },
    },
    {
      title: "Google Drive",
      description: "Embed Google Drive content",
      searchTerms: ["google drive", "gdrive"],
      icon: GoogleDriveIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "gdrive" })
          .run();
      },
    },
    {
      title: "Google Sheets",
      description: "Embed Google Sheets content",
      searchTerms: ["google sheets", "gsheets"],
      icon: GoogleSheetsIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "gsheets" })
          .run();
      },
    },
  ],
};

export const getSuggestionItems = ({
  query,
  excludeItems,
}: {
  query: string;
  excludeItems?: Set<string>;
}): SlashMenuGroupedItemsType => {
  const search = query.toLowerCase();
  const filteredGroups: SlashMenuGroupedItemsType = {};

  const fuzzyMatch = (query: string, target: string) => {
    let queryIndex = 0;
    target = target.toLowerCase();
    for (const char of target) {
      if (query[queryIndex] === char) queryIndex++;
      if (queryIndex === query.length) return true;
    }
    return false;
  };

  for (const [group, items] of Object.entries(CommandGroups)) {
    const filteredItems = items.filter((item) => {
      if (excludeItems?.has(item.title)) return false;
      return (
        fuzzyMatch(search, item.title) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) => term.includes(search)))
      );
    });

    if (filteredItems.length) {
      filteredGroups[group] = filteredItems.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(search) ? 0 : 1;
        const bTitle = b.title.toLowerCase().includes(search) ? 0 : 1;
        return aTitle - bTitle;
      });
    }
  }

  return filteredGroups;
};

export default getSuggestionItems;
