import { button as buttonStyle, container, footer, h1, logo, main } from '../css/styles';
import {
  Body,
  Container,
  Head,
  Html,
  Row,
  Section,
  Text,
} from 'react-email';
import * as React from 'react';
import { EmailTranslator, getEmailTranslator } from '../i18n';

interface MailBodyProps {
  children: React.ReactNode;
  locale?: string;
}

export function MailBody({ children, locale }: MailBodyProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <MailHeader />
        <Container style={container}>{children}</Container>
        <MailFooter locale={locale} />
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

interface MailFooterProps {
  locale?: string;
}

export function MailFooter({ locale }: MailFooterProps) {
  const { t } = getEmailTranslator(locale);
  return (
    <Section style={footer}>
      <Row>
        <Text style={{ textAlign: 'center', color: '#706a7b' }}>
          {t('footer.copyright', { year: new Date().getFullYear() })} <br />
        </Text>
      </Row>
    </Section>
  );
}

export function getGreetingName(name?: string): string {
  return name?.split(' ')[0] || 'there';
}

export function getGreeting(t: EmailTranslator['t'], name?: string): string {
  const firstName = name?.split(' ')[0];
  return firstName
    ? t('common.greetingName', { name: firstName })
    : t('common.greeting');
}
