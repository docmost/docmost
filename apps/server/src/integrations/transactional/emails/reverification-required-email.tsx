import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
}

export const ReverificationRequiredEmail = ({
  pageTitle,
  spaceName,
  pageUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{pageTitle}</strong> in the{' '}
          <strong>{spaceName}</strong> space was updated after approval and
          needs to be re-verified.
        </Text>
      </Section>
      <EmailButton href={pageUrl}>Review page</EmailButton>
    </MailBody>
  );
};

export default ReverificationRequiredEmail;
