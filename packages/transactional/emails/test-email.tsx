import { Container, Section, Text } from "@react-email/components";
import * as React from "react";
import { container, content, paragraph } from "../css/styles";
import { MailBody, MailFooter } from "../partials/partials";

interface WelcomeEmailProps {
  username?: string;
}

export const TestEmail = ({ username }: WelcomeEmailProps) => {
  return (
    <MailBody>
      <Container style={container}>
        <Section style={content}>
          <Text style={paragraph}>Hi {username},</Text>
          <Text style={paragraph}>
            This is a test email. Make sure to read it.
          </Text>
        </Section>
      </Container>
      <MailFooter />
    </MailBody>
  );
};

export default TestEmail;
