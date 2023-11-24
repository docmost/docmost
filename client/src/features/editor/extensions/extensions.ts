import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Superscript } from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { TrailingNode } from '@/features/editor/extensions/trailing-node';
import DragAndDrop from '@/features/editor/extensions/drag-handle';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import SlashCommand from '@/features/editor/extensions/slash-command';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { Comment } from '@/features/editor/extensions/comment/comment';
import { HocuspocusProvider } from '@hocuspocus/provider';

export const mainExtensions = [
  StarterKit.configure({
    history: false,
    dropcursor: {
      width: 3,
      color: '#70CFF8',
    },
  }),
  Placeholder.configure({
    placeholder: 'Enter "/" for commands',
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  Link,
  Superscript,
  SubScript,
  Highlight.configure({
    multicolor: true,
  }),
  Typography,
  TrailingNode,
  DragAndDrop,
  TextStyle,
  Color,
  SlashCommand,
  Comment.configure({
    HTMLAttributes: {
      class: 'comment-mark',
    },
  }),
];

type CollabExtensions = (provider: HocuspocusProvider) => any[];

export const collabExtensions: CollabExtensions = (provider) => [
  Collaboration.configure({
    document: provider.document,
  }),
  CollaborationCursor.configure({
    provider,
  }),
];
