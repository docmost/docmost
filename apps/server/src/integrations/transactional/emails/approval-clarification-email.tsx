import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
}

export const ApprovalClarificationEmail = ({
  actorName,
  pageTitle,
  spaceName,
  pageUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> requested clarification on{' '}
          <strong>{pageTitle}</strong> in the{' '}
          <strong>{spaceName}</strong> space. Please review the comments and
          respond.
        </Text>
      </Section>
      <EmailButton href={pageUrl}>View page</EmailButton>
    </MailBody>
  );
};

export default ApprovalClarificationEmail;
