import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '@docmost/transactional/css/styles';
import { MailBody } from '@docmost/transactional/partials/partials';

interface Props {
  billingLink: string;
  workspaceName: string;
}

export const TrialEndedEmail = ({ billingLink, workspaceName }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          Your Docmost 7-day free trial for {workspaceName} has come to an end.
        </Text>
        <Text style={paragraph}>
          To continue using Docmost for your wiki and documentation, please
          upgrade to a premium plan.
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
        <Button href={billingLink} style={button}>
          Upgrade now
        </Button>
      </Section>
      <Section style={content}>
        <Text style={paragraph}>
          PS: If you would like to extend your trial, please reply this email.
        </Text>
      </Section>
    </MailBody>
  );
};

export default TrialEndedEmail;
