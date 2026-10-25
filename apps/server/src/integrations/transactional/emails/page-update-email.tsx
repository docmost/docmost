import { Link, Section, Text } from 'react-email';
import * as React from 'react';
import { content, link, paragraph } from '../css/styles';
import { EmailButton, getGreeting, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface Props {
  userName: string;
  actorName: string;
  pageTitle: string;
  pageUrl: string;
  spaceName: string;
  locale?: string;
}

export const PageUpdateEmail = ({
  userName,
  actorName,
  pageTitle,
  pageUrl,
  spaceName,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{getGreeting(t, userName)}</Text>
        <Text style={paragraph}>
          {rich('pageUpdate.body', {
            actorName: <strong>{actorName}</strong>,
            pageTitle: (
              <Link href={pageUrl} style={link}>
                <strong>{pageTitle}</strong>
              </Link>
            ),
            spaceName: <strong>{spaceName}</strong>,
          })}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>{t('common.viewPage')}</EmailButton>
    </MailBody>
  );
};

export default PageUpdateEmail;
