import { Section, Text } from '../components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  inviteLink: string;
  expiresInDays: number;
  invitedByName: string;
  message?: string | null;
}

export const InvitationEmail = ({
  inviteLink,
  expiresInDays,
  invitedByName,
  message,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>You have been invited to Docmost.</Text>
        {message && (
          <>
            {invitedByName && (
              <Text style={paragraph}>
                Message from <strong>{invitedByName}</strong>:
              </Text>
            )}
            <Text
              style={{
                ...paragraph,
                fontStyle: 'italic',
                lineHeight: '22px',
                wordBreak: 'break-word',
              }}
            >
              &ldquo;
              {message.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
              &rdquo;
            </Text>
          </>
        )}
        <Text style={paragraph}>
          Please click the button below to accept this invitation.
        </Text>
        <Text style={paragraph}>
          This link is valid for {expiresInDays} days.
        </Text>
      </Section>
      <EmailButton href={inviteLink}>Accept Invite</EmailButton>
    </MailBody>
  );
};

export default InvitationEmail;
