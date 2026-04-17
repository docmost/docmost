import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
}

export const VerificationExpiredEmail = ({ pageTitle, spaceName, pageUrl }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          The verification for <strong>{pageTitle}</strong> in the{' '}
          <strong>{spaceName}</strong> space has expired. Please re-verify the
          page to confirm it is still accurate.
        </Text>
      </Section>
      <EmailButton href={pageUrl}>Re-verify page</EmailButton>
    </MailBody>
  );
};

export default VerificationExpiredEmail;
