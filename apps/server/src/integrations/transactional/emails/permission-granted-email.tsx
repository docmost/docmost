import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { EmailTranslator, getEmailTranslator } from '../i18n';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  accessLabel: string;
  locale?: string;
}

export const PermissionGrantedEmail = ({
  actorName,
  pageTitle,
  pageUrl,
  accessLabel,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('permissionGranted.body', {
            actorName: <strong>{actorName}</strong>,
            accessLabel: getAccessLabel(t, accessLabel),
            pageTitle: <strong>{pageTitle}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>{t('common.view')}</EmailButton>
    </MailBody>
  );
};

export function getAccessLabel(
  t: EmailTranslator['t'],
  accessLabel: string,
): string {
  if (accessLabel === 'edit') return t('permissionGranted.access.edit');
  if (accessLabel === 'view') return t('permissionGranted.access.view');
  return accessLabel;
}

export default PermissionGrantedEmail;
