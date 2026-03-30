import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, link, paragraph } from '../css/styles';
import { getGreetingName, MailBody } from '../partials/partials';

interface PageUpdate {
  title: string;
  url: string;
  updatedBy: string[];
}

interface Props {
  userName: string;
  pageUpdates: PageUpdate[];
  totalUpdates: number;
}

export const PageUpdateDigestEmail = ({
  userName,
  pageUpdates,
  totalUpdates,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>
          Hi {getGreetingName(userName)},
        </Text>
        <Text style={paragraph}>
          There {totalUpdates === 1 ? 'has' : 'have'} been{' '}
          <strong>
            {totalUpdates} update{totalUpdates === 1 ? '' : 's'}
          </strong>{' '}
          since your last update.
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
                Edited by {page.updatedBy.join(', ')}
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
