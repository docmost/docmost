import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  actorName: string;
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
  locale?: string;
}

export const ApprovalRequestedEmail = ({
  actorName,
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
          {rich('approvalRequested.body', {
            actorName: <strong>{actorName}</strong>,
            pageTitle: <strong>{pageTitle}</strong>,
            spaceName: <strong>{spaceName}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>{t('common.reviewPage')}</EmailButton>
    </MailBody>
  );
};

export default ApprovalRequestedEmail;
