import { Button, Link, Section, Text } from 'react-email';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  username: string;
  resetLink: string;
  locale?: string;
}

export const ForgotPasswordEmail = ({ username, resetLink, locale }: Props) => {
  const { t } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>
          {t('common.greetingName', { name: username ?? '' })}
        </Text>
        <Text style={paragraph}>{t('passwordReset.requested')}</Text>
        <Link href={resetLink}> {t('passwordReset.link')}</Link>
        <Text style={paragraph}>{t('passwordReset.validity')}</Text>
        <Text style={paragraph}>{t('passwordReset.ignore')}</Text>
      </Section>
    </MailBody>
  );
};

export default ForgotPasswordEmail;
