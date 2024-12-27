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
  IconPaperclip,
  IconPhoto,
  IconTable,
  IconTypography,
  IconMenu4,
  IconCalendar,
} from "@tabler/icons-react";
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
  LoomIcon,
  MiroIcon,
  TypeformIcon,
  VimeoIcon, YoutubeIcon
} from "@/components/icons";
import { t } from "i18next";

const CommandGroups: SlashMenuGroupedItemsType = {
  [t("basic")]: [
    {
      title: t("Text"),
      description: t("Just start typing with plain text."),
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
      title: t("To-do list"),
      description: t("Track tasks with a to-do list."),
      searchTerms: ["todo", "task", "list", "check", "checkbox"],
      icon: IconCheckbox,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: t("Heading 1"),
      description: t("Big section heading."),
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
      title: t("Heading 2"),
      description: t("Medium section heading."),
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
      title: t("Heading 3"),
      description: t("Small section heading."),
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
      title: t("Bullet list"),
      description: t("Create a simple bullet list."),
      searchTerms: ["unordered", "point", "list"],
      icon: IconList,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: t("Numbered list"),
      description: t("Create a list with numbering."),
      searchTerms: ["numbered", "ordered", "list"],
      icon: IconListNumbers,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: t("Quote"),
      description: t("Create block quote."),
      searchTerms: ["blockquote", "quotes"],
      icon: IconBlockquote,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: t("Code"),
      description: t("Insert code snippet."),
      searchTerms: ["codeblock"],
      icon: IconCode,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: t("Divider"),
      description: t("Insert horizontal rule divider"),
      searchTerms: ["horizontal rule", "hr"],
      icon: IconMenu4,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: t("Image"),
      description: t("Upload any image from your device."),
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
      title: t("Video"),
      description: t("Upload any video from your device."),
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
      title: t("File attachment"),
      description: t("Upload any file from your device."),
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
            if (file.type.includes("image/*")) {
              uploadImageAction(file, editor.view, pos, pageId);
            } else if (file.type.includes("video/*")) {
              uploadVideoAction(file, editor.view, pos, pageId);
            } else {
              uploadAttachmentAction(file, editor.view, pos, pageId);
            }
          }
        };
        input.click();
      },
    },
    {
      title: t("Table"),
      description: t("Insert a table."),
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
      title: t("Toggle block"),
      description: t("Insert collapsible block."),
      searchTerms: ["collapsible", "block", "toggle", "details", "expand"],
      icon: IconCaretRightFilled,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleDetails().run(),
    },
    {
      title: t("Callout"),
      description: t("Insert callout notice."),
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
      title: t("Math inline"),
      description: t("Insert inline math equation."),
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
      title: t("Math block"),
      description: t("Insert math equation"),
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
      title: t("Mermaid diagram"),
      description: t("Insert mermaid diagram"),
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
      title: t("Draw.io (diagrams.net)"),
      description: t("Insert and design Drawio diagrams"),
      searchTerms: ["drawio", "diagrams", "charts", "uml", "whiteboard"],
      icon: IconDrawio,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setDrawio().run(),
    },
    {
      title: t("Excalidraw diagram"),
      description: t("Draw and sketch excalidraw diagrams"),
      searchTerms: ["diagrams", "draw", "sketch", "whiteboard"],
      icon: IconExcalidraw,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setExcalidraw().run(),
    },
    {
      title: t("Date"),
      description: t("Insert current date"),
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
      title: t("Airtable"),
      description: t("Embed Airtable"),
      searchTerms: ["airtable"],
      icon: AirtableIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'airtable' }).run();
      },
    },
    {
      title: t("Loom"),
      description: t("Embed Loom video"),
      searchTerms: ["loom"],
      icon: LoomIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'loom' }).run();
      },
    },
    {
      title: t("Figma"),
      description: t("Embed Figma files"),
      searchTerms: ["figma"],
      icon: FigmaIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'figma' }).run();
      },
    },
    {
      title: t("Typeform"),
      description: t("Embed Typeform"),
      searchTerms: ["typeform"],
      icon: TypeformIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'typeform' }).run();
      },
    },
    {
      title: t("Miro"),
      description: t("Embed Miro board"),
      searchTerms: ["miro"],
      icon: MiroIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'miro' }).run();
      },
    },
    {
      title: t("YouTube"),
      description: t("Embed YouTube video"),
      searchTerms: ["youtube", "yt"],
      icon: YoutubeIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'youtube' }).run();
      },
    },
    {
      title: t("Vimeo"),
      description: t("Embed Vimeo video"),
      searchTerms: ["vimeo"],
      icon: VimeoIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'vimeo' }).run();
      },
    },
    {
      title: t("Framer"),
      description: t("Embed Framer prototype"),
      searchTerms: ["framer"],
      icon: FramerIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'framer' }).run();
      },
    },
    {
      title: t("Google Drive"),
      description: t("Embed Google Drive content"),
      searchTerms: ["google drive", "gdrive"],
      icon: GoogleDriveIcon,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).setEmbed({ provider: 'gdrive' }).run();
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
    for (let char of target) {
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
