import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  pageTitle: string;
  pageUrl: string;
  expiresAt: string;
}

export const VerificationExpiringEmail = ({
  pageTitle,
  pageUrl,
  expiresAt,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          The page <strong>{pageTitle}</strong> needs to be re-verified. The
          verification expires on <strong>{expiresAt}</strong>.
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
          Review page
        </Button>
      </Section>
    </MailBody>
  );
};

export default VerificationExpiringEmail;
