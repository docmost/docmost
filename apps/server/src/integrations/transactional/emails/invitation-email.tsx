import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';
import { EnvironmentService } from 'src/integrations/environment/environment.service';

interface Props {
  appName: string;
  inviteLink: string;
}

export const InvitationEmail = ({ appName, inviteLink }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>You have been invited to {appName}.</Text>
        <Text style={paragraph}>
          Please click the button below to accept this invitation.
        </Text>
      </Section>
      <Section
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: '15px',
          paddingBottom: '15px',
        }}
      >
        <Button href={inviteLink} style={button}>
          Accept Invite
        </Button>
      </Section>
    </MailBody>
  );
};

export default InvitationEmail;
