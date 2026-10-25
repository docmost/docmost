import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
  locale?: string;
}

export const VerificationExpiredEmail = ({
  pageTitle,
  spaceName,
  pageUrl,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('verificationExpired.body', {
            pageTitle: <strong>{pageTitle}</strong>,
            spaceName: <strong>{spaceName}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>
        {t('verificationExpired.button')}
      </EmailButton>
    </MailBody>
  );
};

export default VerificationExpiredEmail;
