import {
  IconBlockquote,
  IconCaretRightFilled,
  IconCheckbox,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconInfoCircle,
  IconList,
  IconListNumbers,
  IconMath,
  IconMathFunction,
  IconMovie,
  IconPaperclip,
  IconPhoto,
  IconTable,
  IconTableOptions,
  IconTypography,
  IconMenu4,
  IconCalendar,
  IconAppWindow,
  IconSitemap,
  IconLink,
  IconColumns,
  IconLayoutColumns,
  IconRectangle,
  IconAt,
} from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { DatePicker } from "../date-picker/date-picker";
import { DatePickerValue, getDateFormat } from "../date-picker/utils";
import { DateSelectionModal } from "../date-picker/date-selection-modal";
import dayjs from "dayjs";
import React from "react";
import {
  CommandProps,
  SlashMenuGroupedItemsType,
} from "@/features/editor/components/slash-menu/types";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAttachmentAction } from "@/features/editor/components/attachment/upload-attachment-action.tsx";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import IconMermaid from "@/components/icons/icon-mermaid";
import IconDrawio from "@/components/icons/icon-drawio";
import {
  AirtableIcon,
  FigmaIcon,
  FramerIcon,
  GoogleDriveIcon,
  GoogleDocsIcon,
  GoogleSheetsIcon,
  LoomIcon,
  MiroIcon,
  TypeformIcon,
  VimeoIcon,
  YoutubeIcon,
} from "@/components/icons";

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
      description: "Use this for a top level heading",
      searchTerms: ["title", "h1"],
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
      description: "Use this for key sections.",
      searchTerms: ["section", "h2"],
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
      description: "Use this for sub-sections.",
      searchTerms: ["sub section", "h3"],
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
      title: "Heading 4",
      description: "Use this for deep headings.",
      searchTerms: ["deep heading", "h4"],
      icon: IconH4,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 4 })
          .run();
      },
    },
    {
      title: "Heading 5",
      description: "Use this for grouping list items.",
      searchTerms: ["grouping", "h5"],
      icon: IconH5,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 5 })
          .run();
      },
    },
    {
      title: "Heading 6",
      description: "Use this for low level headings.",
      searchTerms: ["low level heading", "h6"],
      icon: IconH6,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 6 })
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
      searchTerms: ["photo", "picture", "media"],
      icon: IconPhoto,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload image
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;
              uploadImageAction(file, editor.view, pos, pageId);
            }
          }
        };
        input.click();
      },
    },
    {
      title: "Video",
      description: "Upload any video from your device.",
      searchTerms: ["video", "mp4", "media"],
      icon: IconMovie,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload video
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.onchange = async () => {
          if (input.files?.length) {
            const file = input.files[0];
            const pos = editor.view.state.selection.from;
            uploadVideoAction(file, editor.view, pos, pageId);
          }
        };
        input.click();
      },
    },
    {
      title: "File attachment",
      description: "Upload any file from your device.",
      searchTerms: ["file", "attachment", "upload", "pdf", "csv", "zip"],
      icon: IconPaperclip,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload file
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "";
        input.onchange = async () => {
          if (input.files?.length) {
            const file = input.files[0];
            const pos = editor.view.state.selection.from;
            uploadAttachmentAction(file, editor.view, pos, pageId, true);
          }
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
      title: "Table View",
      description: "Insert a Notion-like data table.",
      searchTerms: ["table view", "database", "data table", "notion"],
      icon: IconTableOptions,
      command: ({ editor, range }: CommandProps) =>
        (editor.chain().focus() as any)
          .deleteRange(range)
          .insertDataTable()
          .run(),
    },
    {
      title: "1 Column",
      description: "Insert a single column block.",
      searchTerms: ["columns", "layout", "one column", "full width"],
      icon: IconRectangle,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ widths: [100] })
          .run(),
    },
    {
      title: "2 Columns",
      description: "Insert two side-by-side columns.",
      searchTerms: ["columns", "layout", "two columns", "side by side"],
      icon: IconLayoutColumns,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ widths: [50, 50] })
          .run(),
    },
    {
      title: "3 Columns",
      description: "Insert three equal columns.",
      searchTerms: ["columns", "layout", "three columns"],
      icon: IconColumns,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ widths: [33.33, 33.33, 33.34] })
          .run(),
    },
    {
      title: "4 Columns",
      description: "Insert four equal columns.",
      searchTerms: ["columns", "layout", "four columns"],
      icon: IconColumns,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ widths: [25, 25, 25, 25] })
          .run(),
    },
    {
      title: "5 Columns",
      description: "Insert five equal columns.",
      searchTerms: ["columns", "layout", "five columns"],
      icon: IconColumns,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ widths: [20, 20, 20, 20, 20] })
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
      title: "Draw.io (diagrams.net) ",
      description: "Insert and design Drawio diagrams",
      searchTerms: ["drawio", "diagrams", "charts", "uml", "whiteboard"],
      icon: IconDrawio,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setDrawio().run(),
    },
    {
      title: "Excalidraw diagram",
      description: "Draw and sketch excalidraw diagrams",
      searchTerms: ["diagrams", "draw", "sketch", "whiteboard"],
      icon: IconExcalidraw,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setExcalidraw().run(),
    },
    {
      title: "Date",
      description: "Insert a date using a calendar picker.",
      searchTerms: ["date", "today", "calendar", "picker"],
      icon: IconCalendar,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).run();

        const initialValue: DatePickerValue = {
          start: new Date(),
          end: null,
          includeTime: false,
          format: "full",
        };

        modals.open({
          title: "Select Date",
          children: React.createElement(DateSelectionModal, {
            initialValue,
            onConfirm: (currentValue: DatePickerValue) => {
              if (!currentValue.start) return;

              const format = getDateFormat(currentValue.format, currentValue.includeTime);
              let str = dayjs(currentValue.start).format(format);

              if (currentValue.end) {
                str += ` → ${dayjs(currentValue.end).format(format)}`;
              }

              editor.chain().focus().insertContent(str).run();
            },
          }),
        });
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
      title: "Insert Link",
      description: "Link to a page or URL",
      searchTerms: ["page", "link", "url", "insert"],
      icon: IconLink,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "insertLink" })
          .run();
      },
    },
    {
      title: "Mention member",
      description: "Mention a member in this document.",
      searchTerms: ["mention", "user", "person", "at", "member"],
      icon: IconAt,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).insertContent("@").run();
      },
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
      searchTerms: ["youtube", "yt"],
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
    {
      title: "Google Docs",
      description: "Embed Google Docs content",
      searchTerms: ["google docs", "gdocs"],
      icon: GoogleDocsIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "gdoc" })
          .run();
      },
    },
  ],
};

export const getSuggestionItems = ({
  query,
}: {
  query: string;
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
      return (
        fuzzyMatch(search, item.title) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms &&
          item.searchTerms.some((term: string) => term.includes(search)))
      );
    });

    if (filteredItems.length) {
      filteredGroups[group] = filteredItems;
    }
  }

  return filteredGroups;
};

export default getSuggestionItems;
