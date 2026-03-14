import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  inviteLink: string;
}

export const InvitationEmail = ({ inviteLink }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>You have been invited to Docmost.</Text>
        <Text style={paragraph}>
          Please click the button below to accept this invitation.
        </Text>
      </Section>
      <EmailButton href={inviteLink}>Accept Invite</EmailButton>
    </MailBody>
  );
};

export default InvitationEmail;
