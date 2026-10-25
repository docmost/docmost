import { Link, Section, Text } from 'react-email';
import * as React from 'react';
import { content, link, paragraph } from '../css/styles';
import { getGreeting, MailBody } from '../partials/partials';
import { getEmailTranslator } from '../i18n';

interface PageUpdate {
  title: string;
  url: string;
  updatedBy: string[];
}

interface Props {
  userName: string;
  pageUpdates: PageUpdate[];
  totalUpdates: number;
  locale?: string;
}

export const PageUpdateDigestEmail = ({
  userName,
  pageUpdates,
  totalUpdates,
  locale,
}: Props) => {
  const { t, rich } = getEmailTranslator(locale);
  const isSingle = totalUpdates === 1;
  return (
    <MailBody locale={locale}>
      <Section style={content}>
        <Text style={paragraph}>{getGreeting(t, userName)}</Text>
        <Text style={paragraph}>
          {rich(
            isSingle
              ? 'pageUpdateDigest.summary_one'
              : 'pageUpdateDigest.summary_other',
            {
              updates: (
                <strong>
                  {t(
                    isSingle
                      ? 'pageUpdateDigest.updates_one'
                      : 'pageUpdateDigest.updates_other',
                    { count: totalUpdates },
                  )}
                </strong>
              ),
            },
          )}
        </Text>

        {pageUpdates.map((page, i) => (
          <Section key={i} style={pageCard}>
            <Text style={pageTitle}>
              <Link href={page.url} style={link}>
                {page.title}
              </Link>
            </Text>
            {page.updatedBy.length > 0 && (
              <Text style={updatedByText}>
                {t('pageUpdateDigest.editedBy', {
                  names: page.updatedBy.join(', '),
                })}
              </Text>
            )}
          </Section>
        ))}
      </Section>
    </MailBody>
  );
};

const pageCard = {
  borderLeft: '3px solid #e8e5ef',
  paddingLeft: '12px',
  marginBottom: '12px',
};

const pageTitle = {
  ...paragraph,
  margin: '0 0 2px 0',
  fontSize: 14,
  fontWeight: 'bold' as const,
};

const updatedByText = {
  ...paragraph,
  margin: '0',
  fontSize: 13,
  color: '#666',
};

export default PageUpdateDigestEmail;
