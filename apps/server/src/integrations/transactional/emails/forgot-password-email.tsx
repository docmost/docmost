import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
    username: string;
    code: string;
}

export const ForgotPasswordEmail = ({ username, code }: Props) => {
    return (
        <MailBody>
          <Section style={content}>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              The code for resetting your password is: <strong>{code}</strong>.
            </Text>
            <Text style={paragraph}>
              If you did not request a password reset, please ignore this email.
            </Text>
          </Section>
        </MailBody>
      );
}

export default ForgotPasswordEmail;