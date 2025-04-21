import { Button, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  username: string;
  resetLink: string;
}

export const ForgotPasswordEmail = ({ username, resetLink }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi {username},</Text>
        <Text style={paragraph}>
          We received a request from you to reset your password.
        </Text>
          <Link href={resetLink}> Click here to set a new password</Link>
        <Text style={paragraph}>
          If you did not request a password reset, please ignore this email.
        </Text>
      </Section>
    </MailBody>
  );
};

export default ForgotPasswordEmail;
