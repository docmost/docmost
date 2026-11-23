import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { formatISO } from 'date-fns';

type DateStorage = { justInserted: ProseMirrorNode | null };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    date: { insertDate: () => ReturnType };
  }
  interface Storage {
    date: DateStorage;
  }
}

function parseCalendarDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const day = new Date(value);
  if (
    Number.isFinite(day.getTime()) &&
    day.getUTCFullYear() > 0 &&
    day.toISOString().slice(0, 10) === value
  ) {
    return day;
  }
}

export function formatDateLabel(value: unknown, locale = 'en-US'): string {
  const day = parseCalendarDate(value);
  if (!day) return '';
  return day.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const DateNode = Node.create<{ locale: () => string }, DateStorage>({
  name: 'date',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { locale: () => 'en-US' };
  },

  addStorage() {
    return { justInserted: null };
  },

  addAttributes() {
    return {
      date: {
        default: null,
        parseHTML: (element) => element.getAttribute('datetime'),
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'time[data-type="date"][datetime]',
        getAttrs: (element) =>
          parseCalendarDate(element.getAttribute('datetime')) ? null : false,
      },
    ];
  },

  extendNodeSchema(extension) {
    if (extension.name === 'date') {
      return {
        leafText: (node: ProseMirrorNode) =>
          formatDateLabel(node.attrs.date, this.options.locale()),
      };
    }
    return {};
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'time',
      mergeAttributes(HTMLAttributes, {
        'data-type': this.name,
        datetime: node.attrs.date,
      }),
      node.textContent,
    ];
  },

  renderText({ node }) {
    return node.textContent;
  },

  addCommands() {
    return {
      insertDate: () => ({ commands, editor, tr, dispatch }) => {
        if (!editor.isEditable) return false;
        const date = formatISO(new Date(), { representation: 'date' });
        if (tr.selection.$from.parent.type.spec.code) {
          return commands.insertContent(formatDateLabel(date, this.options.locale()));
        }
        if (dispatch) {
          tr.replaceSelectionWith(this.type.create({ date }));
          // Only the view of this local insertion should open its picker.
          this.storage.justInserted = tr.selection.$from.nodeBefore;
        }
        return true;
      },
    };
  },
});
