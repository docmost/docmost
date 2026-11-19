import * as React from 'react';
import { Section, Text } from '../components';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  pageTitle: string;
  title: string;
  checked: boolean;
  dueDate: string | null;
  taskUrl: string;
}

export function TaskAssignmentEmail({
  pageTitle,
  title,
  checked,
  dueDate,
  taskUrl,
}: Props) {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>
          You were assigned a task in <strong>{pageTitle}</strong>.
        </Text>
        <table
          role="presentation"
          cellPadding="0"
          cellSpacing="0"
          style={{ backgroundColor: '#f6f7f8', borderRadius: 6, width: '100%' }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  verticalAlign: 'top',
                  width: 20,
                  padding: '12px 0 12px 14px',
                  fontSize: 18,
                }}
              >
                {checked ? '☑' : '☐'}&nbsp;
              </td>
              <td
                style={{
                  padding: '12px 14px 12px 8px',
                  lineHeight: '22px',
                  overflowWrap: 'anywhere',
                }}
              >
                {title || 'Untitled task'}
                {dueDate && (
                  <div style={{ color: '#62666c', fontSize: 13 }}>
                    Due {dueDate}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <EmailButton href={taskUrl}>Open task</EmailButton>
    </MailBody>
  );
}
