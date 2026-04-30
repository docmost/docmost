import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
}

export const ApprovalRequestedEmail = ({
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
          <strong>{actorName}</strong> submitted{' '}
          <strong>{pageTitle}</strong> in the{' '}
          <strong>{spaceName}</strong> space for your approval.
        </Text>
      </Section>
      <EmailButton href={pageUrl}>Review page</EmailButton>
    </MailBody>
  );
};

export default ApprovalRequestedEmail;
