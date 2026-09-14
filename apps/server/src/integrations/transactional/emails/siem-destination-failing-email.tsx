import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

type Props = {
  destinationName: string;
  destinationType: string;
  lastError: string;
  failingSince: string;
  settingsLink: string;
};

export const SiemDestinationFailingEmail = ({
  destinationName,
  destinationType,
  lastError,
  failingSince,
  settingsLink,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          Docmost cannot deliver audit events to your SIEM destination{' '}
          <strong>{destinationName}</strong> ({destinationType}).
        </Text>
        <Text style={paragraph}>Last error: {lastError}</Text>
        <Text style={paragraph}>Failing since {failingSince}.</Text>
        <Text style={paragraph}>
          Docmost keeps retrying every 30 minutes. If the destination is still
          failing 24 hours after it started, it is disabled automatically.
        </Text>
      </Section>
      <EmailButton href={settingsLink}>View destination</EmailButton>
    </MailBody>
  );
};

export default SiemDestinationFailingEmail;
