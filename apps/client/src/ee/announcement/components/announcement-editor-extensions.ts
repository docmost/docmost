import { Extension, type Extensions } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Fragment, Slice, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { isSafeAnnouncementHref } from "@/ee/announcement/announcement.utils";

function flattenToParagraph(slice: Slice, schema: Schema): Slice {
  const blocks: Fragment[] = [];
  if (slice.content.firstChild?.isInline) {
    blocks.push(slice.content);
  } else {
    slice.content.descendants((node) => {
      if (node.isTextblock) {
        blocks.push(node.content);
      }
      return !node.isTextblock;
    });
  }

  let inline = Fragment.empty;
  for (const block of blocks) {
    if (block.size === 0) {
      continue;
    }
    inline =
      inline.size === 0
        ? block
        : inline.append(Fragment.from(schema.text(" "))).append(block);
  }
  return new Slice(
    Fragment.from(schema.nodes.paragraph.create(null, inline)),
    1,
    1,
  );
}

const SingleParagraph = Extension.create({
  name: "announcementSingleParagraph",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      "Shift-Enter": () => true,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("announcementSingleParagraph"),
        props: {
          transformPasted: (slice, view) =>
            flattenToParagraph(slice, view.state.schema),
        },
      }),
    ];
  },
});

export function createAnnouncementEditorExtensions(
  placeholder: string,
): Extensions {
  return [
    StarterKit.configure({
      document: false,
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      hardBreak: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      strike: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        isAllowedUri: (url) => isSafeAnnouncementHref(url),
      },
    }),
    Document.extend({ content: "paragraph" }),
    Placeholder.configure({ placeholder }),
    SingleParagraph,
  ];
}
