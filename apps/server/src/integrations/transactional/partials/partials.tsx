import { button as buttonStyle, container, footer, h1, logo, main } from '../css/styles';
import {
  Body,
  Container,
  Head,
  Html,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface MailBodyProps {
  children: React.ReactNode;
}

export function MailBody({ children }: MailBodyProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <MailHeader />
        <Container style={container}>{children}</Container>
        <MailFooter />
      </Body>
    </Html>
  );
}

export function MailHeader() {
  return (
    <Section style={logo}>
      {/* <Heading style={h1}>docmost</Heading> */}
    </Section>
  );
}

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      style={{ margin: '0 0 15px 15px' }}
    >
      <tr>
        <td
          style={{
            backgroundColor: buttonStyle.backgroundColor,
            borderRadius: buttonStyle.borderRadius,
            textAlign: 'center' as const,
          }}
        >
          <a
            href={href}
            target="_blank"
            style={{
              color: buttonStyle.color,
              fontFamily: buttonStyle.fontFamily,
              fontSize: buttonStyle.fontSize,
              textDecoration: 'none',
              display: 'inline-block',
              padding: '8px 16px',
            }}
          >
            {children}
          </a>
        </td>
      </tr>
    </table>
  );
}

export function MailFooter() {
  return (
    <Section style={footer}>
      <Row>
        <Text style={{ textAlign: 'center', color: '#706a7b' }}>
          © {new Date().getFullYear()} Docmost, All Rights Reserved <br />
        </Text>
      </Row>
    </Section>
  );
}
