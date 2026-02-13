import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  isMention: boolean;
}

export const CommentNotificationEmail = ({
  actorName,
  pageTitle,
  pageUrl,
  isMention,
}: Props) => {
  const action = isMention ? 'mentioned you in a comment on' : 'commented on';

  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> {action}{' '}
          <strong>{pageTitle || 'Untitled'}</strong>.
        </Text>
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
          View Page
        </Button>
      </Section>
    </MailBody>
  );
};

export default CommentNotificationEmail;
