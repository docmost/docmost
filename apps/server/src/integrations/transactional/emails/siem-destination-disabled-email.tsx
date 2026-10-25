import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

type Props = {
  destinationName: string;
  destinationType: string;
  lastError: string;
  failingSince: string;
  settingsLink: string;
  locale?: string;
};

export const SiemDestinationDisabledEmail = ({
  destinationName,
  destinationType,
  lastError,
  failingSince,
  settingsLink,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('siemDestinationDisabled.body', {
            name: <strong>{destinationName}</strong>,
            type: destinationType,
            since: failingSince,
          })}
        </Text>
        <Text style={paragraph}>
          {t('siem.lastError', { error: lastError })}
        </Text>
        <Text style={paragraph}>{t('siemDestinationDisabled.resume')}</Text>
      </Section>
      <EmailButton href={settingsLink}>{t('siem.viewDestination')}</EmailButton>
    </MailBody>
  );
};

export default SiemDestinationDisabledEmail;
