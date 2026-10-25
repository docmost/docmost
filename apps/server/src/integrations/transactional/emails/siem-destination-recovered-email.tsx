import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

type Props = {
  destinationName: string;
  destinationType: string;
  settingsLink: string;
  locale?: string;
};

export const SiemDestinationRecoveredEmail = ({
  destinationName,
  destinationType,
  settingsLink,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('siemDestinationRecovered.body', {
            name: <strong>{destinationName}</strong>,
            type: destinationType,
          })}
        </Text>
        <Text style={paragraph}>{t('siemDestinationRecovered.buffered')}</Text>
      </Section>
      <EmailButton href={settingsLink}>{t('siem.viewDestination')}</EmailButton>
    </MailBody>
  );
};

export default SiemDestinationRecoveredEmail;
