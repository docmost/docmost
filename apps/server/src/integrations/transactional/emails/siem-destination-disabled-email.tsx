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

export const SiemDestinationDisabledEmail = ({
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
          Your SIEM destination <strong>{destinationName}</strong> (
          {destinationType}) has been failing since {failingSince} and was
          disabled after 24 hours of failed deliveries.
        </Text>
        <Text style={paragraph}>Last error: {lastError}</Text>
        <Text style={paragraph}>
          Your events are kept and delivery resumes from where it stopped when
          you re-enable it.
        </Text>
      </Section>
      <EmailButton href={settingsLink}>View destination</EmailButton>
    </MailBody>
  );
};

export default SiemDestinationDisabledEmail;
