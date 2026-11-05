import { Section, Text } from '../components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
  verificationType: string;
  previousStatus: string;
}

export const VerificationInvalidatedEmail = ({
  actorName,
  pageTitle,
  spaceName,
  pageUrl,
  verificationType,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> changed <strong>{pageTitle}</strong> in
          the <strong>{spaceName}</strong> space.{' '}
          {verificationType === 'qms'
            ? 'It is back in draft and needs to be approved again.'
            : 'Its verification was removed until it is verified again.'}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>Review page</EmailButton>
    </MailBody>
  );
};

export default VerificationInvalidatedEmail;
