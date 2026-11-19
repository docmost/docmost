import { extractPageTasks } from './task-content';

const first = '01972111-8b87-7491-9f76-3cd70d34df01';
const second = '01972111-8b87-7491-9f76-3cd70d34df02';
const mention = (entityType: string, entityId: string, label: string) => ({
  type: 'mention',
  attrs: { entityType, entityId, label },
});
const date = (day: string) => ({ type: 'date', attrs: { date: day } });
const paragraph = (...content: object[]) => ({ type: 'paragraph', content });

describe('extractPageTasks', () => {
  it('keeps a single assignee and calendar date per item in document order', () => {
    const tasks = extractPageTasks({
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { id: 'parent' },
          content: [
            paragraph(
              { type: 'text', text: 'Review ' },
              mention('page', second, 'Guide'),
              { type: 'text', text: ' with ' },
              mention('user', first, 'A'),
            ),
            paragraph(
              mention('user', second, 'B'),
              date('2026-02-31'),
              date('2028-02-29'),
              date('2028-03-01'),
            ),
            {
              type: 'taskList',
              content: [
                {
                  type: 'taskItem',
                  attrs: { checked: true },
                  content: [
                    paragraph(mention('user', second, 'B'), date('2026-12-15')),
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(tasks).toEqual([
      {
        blockId: 'parent',
        checked: false,
        title: 'Review Guide with @A @B 2028-02-29 2028-03-01',
        assigneeId: first,
        dueDate: '2028-02-29',
      },
      {
        blockId: 'task-0-2-0',
        checked: true,
        title: '@B',
        assigneeId: second,
        dueDate: '2026-12-15',
      },
    ]);
  });

  it('keeps an unassigned parent and ignores plain dates and malformed mentions', () => {
    const [parent] = extractPageTasks({
      type: 'taskItem',
      content: [
        paragraph(
          { type: 'text', text: 'Review on 2026-12-15 ' },
          mention('user', 'invalid', 'old user'),
          date('0000-01-01'),
        ),
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [
                paragraph(mention('user', first, 'A'), date('2026-12-15')),
              ],
            },
          ],
        },
      ],
    });
    expect(parent).toMatchObject({
      title: 'Review on 2026-12-15 @old user',
      assigneeId: null,
      dueDate: null,
    });
  });
});
