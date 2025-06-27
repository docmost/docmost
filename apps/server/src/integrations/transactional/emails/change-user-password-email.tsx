import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  username?: string;
  actorUsername?: string;
}

export const ChangeUserPasswordEmail = ({ username, actorUsername }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi {username},</Text>
        <Text style={paragraph}>
          This is to inform you that your password was changed successfully by {actorUsername}.
        </Text>
      </Section>
    </MailBody>
  );
};

export default ChangeUserPasswordEmail;
