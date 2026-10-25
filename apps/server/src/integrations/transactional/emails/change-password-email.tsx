import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  username?: string;
  locale?: string;
}

export const ChangePasswordEmail = ({ username, locale }: Props) => {
  const { t } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>
          {t('common.greetingName', { name: username ?? '' })}
        </Text>
        <Text style={paragraph}>{t('passwordChanged.body')}</Text>
      </Section>
    </MailBody>
  );
};

export default ChangePasswordEmail;
