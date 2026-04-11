import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  comment?: string;
}

export const ApprovalRejectedEmail = ({
  actorName,
  pageTitle,
  pageUrl,
  comment,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> returned{' '}
          <strong>{pageTitle}</strong> for revision.
        </Text>
        {comment && (
          <Text style={{ ...paragraph, fontStyle: 'italic' }}>
            &ldquo;{comment}&rdquo;
          </Text>
        )}
      </Section>
      <Section
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: '15px',
          paddingBottom: '15px',
        }}
      >
        <Button href={pageUrl} style={button}>
          View page
        </Button>
      </Section>
    </MailBody>
  );
};

export default ApprovalRejectedEmail;
