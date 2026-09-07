import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

type Props = {
  destinationName: string;
  destinationType: string;
  settingsLink: string;
};

export const SiemDestinationRecoveredEmail = ({
  destinationName,
  destinationType,
  settingsLink,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          Your SIEM destination <strong>{destinationName}</strong> (
          {destinationType}) is delivering audit events again.
        </Text>
        <Text style={paragraph}>
          Events buffered during the outage were delivered from where the stream
          stopped.
        </Text>
      </Section>
      <EmailButton href={settingsLink}>View destination</EmailButton>
    </MailBody>
  );
};

export default SiemDestinationRecoveredEmail;
