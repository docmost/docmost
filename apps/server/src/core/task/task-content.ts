import type { JSONContent } from '@tiptap/core';
import { validate as isUuid } from 'uuid';

export type PageTaskItem = {
  blockId: string;
  title: string;
  assigneeId: string | null;
  assigneeMentionId?: string;
  dueDate: string | null;
  checked: boolean;
};

// Older documents and raw API input can lack block IDs. Both the indexer and
// the collaboration server use the same ID until it is saved on the task node.
export function taskBlockId(
  value: unknown,
  path: number[],
  seen: Set<string>,
  generateId?: () => string,
) {
  let id =
    typeof value === 'string' && /^[\w-]{1,128}$/.test(value) ? value : '';
  if (!id || seen.has(id)) {
    id = generateId?.() ?? `task-${path.join('-')}`;
    while (seen.has(id)) id += '-';
  }
  seen.add(id);
  return id;
}

function calendarDate(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000')
  )
    return null;
  const day = new Date(value);
  return Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function readTaskItem(node: JSONContent, blockId: string): PageTaskItem {
  const task: PageTaskItem = {
    blockId,
    checked: node.attrs?.checked === true,
    title: '',
    assigneeId: null,
    dueDate: null,
  };
  const words: string[] = [];
  let dueDatePosition = -1;
  // Only the item's own paragraphs contribute. Children in a nested list
  // are visited independently below.
  for (const paragraph of node.content ?? []) {
    if (paragraph.type !== 'paragraph') continue;
    for (const inline of paragraph.content ?? []) {
      const attrs = inline.attrs;
      if (inline.type === 'mention') {
        if (
          attrs?.entityType === 'user' &&
          !task.assigneeId &&
          isUuid(attrs.entityId)
        ) {
          task.assigneeId = attrs.entityId;
          if (typeof attrs.id === 'string') task.assigneeMentionId = attrs.id;
        }
        if (typeof attrs?.label === 'string')
          words.push((attrs.entityType === 'user' ? '@' : '') + attrs.label);
      } else if (inline.type === 'date') {
        const date = calendarDate(attrs?.date);
        if (date) {
          if (!task.dueDate) {
            task.dueDate = date;
            dueDatePosition = words.length;
          }
          words.push(' ' + date + ' ');
        }
      } else if (inline.type === 'status' && typeof attrs?.text === 'string') {
        words.push(attrs.text);
      } else if (inline.type === 'hardBreak') words.push(' ');
      else if (typeof inline.text === 'string') words.push(inline.text);
    }
    words.push(' ');
  }
  // A trailing due date is already shown beside the title. Keep dates inside
  // sentences so lines such as "Compare May 1 with May 8" retain their meaning.
  if (
    dueDatePosition >= 0 &&
    words.slice(dueDatePosition + 1).every((word) => !word.trim())
  ) {
    words[dueDatePosition] = '';
  }
  task.title = words.join('').replace(/\s+/g, ' ').trim();
  return task;
}

export function extractPageTasks(content: unknown): PageTaskItem[] {
  const tasks: PageTaskItem[] = [];
  const seen = new Set<string>();
  const path: number[] = [];
  function visit(node: JSONContent) {
    if (!node || !Array.isArray(node.content)) return;
    if (node.type === 'taskItem') {
      tasks.push(readTaskItem(node, taskBlockId(node.attrs?.id, path, seen)));
    }
    node.content.forEach((child, index) => {
      path.push(index);
      visit(child);
      path.pop();
    });
  }
  visit(content as JSONContent);
  return tasks;
}
