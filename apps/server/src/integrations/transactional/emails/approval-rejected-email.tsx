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
  comment?: string;
  locale?: string;
}

export const ApprovalRejectedEmail = ({
  actorName,
  pageTitle,
  spaceName,
  pageUrl,
  comment,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('approvalRejected.body', {
            actorName: <strong>{actorName}</strong>,
            pageTitle: <strong>{pageTitle}</strong>,
            spaceName: <strong>{spaceName}</strong>,
          })}
        </Text>
        {comment && (
          <Text style={{ ...paragraph, fontStyle: 'italic' }}>
            &ldquo;{comment}&rdquo;
          </Text>
        )}
      </Section>
      <EmailButton href={pageUrl}>{t('common.viewPage')}</EmailButton>
    </MailBody>
  );
};

export default ApprovalRejectedEmail;
