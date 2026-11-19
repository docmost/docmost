import * as React from 'react';
import { Link, Section, Text } from '../components';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import type { TaskActivityKind } from '@docmost/db/repos/page-task/task-activity.repo';

type Item = {
  taskUrl: string;
  title: string;
  pageTitle: string;
  checked: boolean;
  dueDate: string | null;
  kind: TaskActivityKind;
};

const action = {
  assigned: 'Assigned to you',
  completed: 'Completed',
  reopened: 'Reopened',
};
const subject = {
  assigned: 'Task assigned to you',
  completed: 'Task completed',
  reopened: 'Task reopened',
};

export function taskActivitySubject(first: Item, count: number) {
  return count === 1
    ? `${subject[first.kind]} in ${first.pageTitle}`
    : `${count} task updates in Docmost`;
}

export function TaskActivityEmail({
  items,
  count,
  activityUrl,
}: {
  items: Item[];
  count: number;
  activityUrl: string;
}) {
  const first = items[0];
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>
          {count === 1
            ? taskActivitySubject(first, count)
            : `You have ${count} task updates.`}
        </Text>
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={{ backgroundColor: '#f6f7f8', borderRadius: 6, width: '100%' }}
        >
          <tbody>
            {items.map((item, index) => (
              <tr key={item.taskUrl}>
                <td
                  style={{
                    width: 20,
                    verticalAlign: 'top',
                    padding: '12px 0 12px 14px',
                    fontSize: 18,
                  }}
                >
                  {item.checked ? '☑' : '☐'}&nbsp;
                </td>
                <td
                  style={{
                    borderTop: index ? '1px solid #dee2e6' : undefined,
                    padding: '12px 14px 12px 8px',
                    lineHeight: '22px',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <Link
                    href={item.taskUrl}
                    style={{ color: '#212529', fontWeight: 600 }}
                  >
                    {item.title || 'Untitled task'}
                  </Link>
                  <div style={{ color: '#62666c', fontSize: 13 }}>
                    {action[item.kind]} · {item.pageTitle}
                    {item.dueDate ? ` · Due ${item.dueDate}` : ''}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {count > items.length && (
          <Text style={paragraph}>And {count - items.length} more.</Text>
        )}
      </Section>
      <EmailButton href={count === 1 ? first.taskUrl : activityUrl}>
        {count === 1 ? 'Open task' : 'View all task updates'}
      </EmailButton>
    </MailBody>
  );
}
