import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  locale?: string;
}

export const PageMentionEmail = ({
  actorName,
  pageTitle,
  pageUrl,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{t('common.greeting')}</Text>
        <Text style={paragraph}>
          {rich('pageMention.body', {
            actorName: <strong>{actorName}</strong>,
            pageTitle: <strong>{pageTitle}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>{t('common.view')}</EmailButton>
    </MailBody>
  );
};

export default PageMentionEmail;
