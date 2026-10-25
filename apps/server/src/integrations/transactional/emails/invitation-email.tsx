import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  inviteLink: string;
  locale?: string;
}

export const InvitationEmail = ({ inviteLink, locale }: Props) => {
  const { t } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>{t('invitation.body')}</Text>
        <Text style={paragraph}>{t('invitation.instruction')}</Text>
      </Section>
      <EmailButton href={inviteLink}>{t('invitation.accept')}</EmailButton>
    </MailBody>
  );
};

export default InvitationEmail;
