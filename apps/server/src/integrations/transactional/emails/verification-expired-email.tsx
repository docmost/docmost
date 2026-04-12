import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  pageTitle: string;
  pageUrl: string;
}

export const VerificationExpiredEmail = ({ pageTitle, pageUrl }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          The verification for <strong>{pageTitle}</strong> has expired. Please
          re-verify the page to confirm it is still accurate.
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
        <Button href={pageUrl} style={button}>
          Re-verify page
        </Button>
      </Section>
    </MailBody>
  );
};

export default VerificationExpiredEmail;
