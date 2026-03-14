import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
}

export const CommentResolvedEmail = ({
  actorName,
  pageTitle,
  pageUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> resolved a comment on{' '}
          <strong>{pageTitle}</strong>.
        </Text>
      </Section>
      <EmailButton href={pageUrl}>View</EmailButton>
    </MailBody>
  );
};

export default CommentResolvedEmail;
