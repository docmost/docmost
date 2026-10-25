import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  invitedUserName: string;
  invitedUserEmail: string;
  locale?: string;
}

export const InvitationAcceptedEmail = ({
  invitedUserName,
  invitedUserEmail,
  locale,
}: Props) => {
  const { t } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {t('invitationAccepted.body', {
            name: invitedUserName,
            email: invitedUserEmail,
          })}
        </Text>
      </Section>
    </MailBody>
  );
};

export default InvitationAcceptedEmail;
