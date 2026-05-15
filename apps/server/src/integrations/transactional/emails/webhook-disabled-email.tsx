import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody, getGreetingName } from '../partials/partials';

interface Props {
  recipientName?: string;
  webhookName: string;
  webhookUrl: string;
  settingsUrl: string;
}

export const WebhookDisabledEmail = ({
  recipientName,
  webhookName,
  webhookUrl,
  settingsUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi {getGreetingName(recipientName)},</Text>
        <Text style={paragraph}>
          Your webhook <strong>{webhookName}</strong> to{' '}
          <strong>{webhookUrl}</strong> has been disabled after too many
          consecutive delivery failures.
        </Text>
        <Text style={paragraph}>
          Re-enable it in your workspace settings once the receiving endpoint
          is healthy again.
        </Text>
      </Section>
      <EmailButton href={settingsUrl}>Open webhook settings</EmailButton>
    </MailBody>
  );
};

export default WebhookDisabledEmail;
