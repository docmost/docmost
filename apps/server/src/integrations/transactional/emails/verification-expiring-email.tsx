import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
  expiresAt: string;
  locale?: string;
}

export const VerificationExpiringEmail = ({
  pageTitle,
  spaceName,
  pageUrl,
  expiresAt,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('verificationExpiring.body', {
            pageTitle: <strong>{pageTitle}</strong>,
            spaceName: <strong>{spaceName}</strong>,
            expiresAt: <strong>{expiresAt}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>{t('common.reviewPage')}</EmailButton>
    </MailBody>
  );
};

export default VerificationExpiringEmail;
