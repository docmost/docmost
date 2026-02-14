import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
}

export const PageMentionEmail = ({ actorName, pageTitle, pageUrl }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> mentioned you in{' '}
          <strong>{pageTitle}</strong>.
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
          View
        </Button>
      </Section>
    </MailBody>
  );
};

export default PageMentionEmail;
