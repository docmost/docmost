import { footer, h1, logo, main } from "../css/styles";
import {
  Body,
  Head,
  Heading,
  Html,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface MailBodyProps {
  children: React.ReactNode;
}
export function MailBody({ children }: MailBodyProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>{children}</Body>
    </Html>
  );
}

export function MailHeader() {
  return (
    <Section style={logo}>
      <Heading style={h1}>logo/text</Heading>
    </Section>
  );
}

export function MailFooter() {
  return (
    <Section style={footer}>
      <Row>
        <Text style={{ textAlign: "center", color: "#706a7b" }}>
          © {new Date().getFullYear()}, All Rights Reserved <br />
        </Text>
      </Row>
    </Section>
  );
}
