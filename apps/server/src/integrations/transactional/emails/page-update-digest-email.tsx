import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, link, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface PageUpdate {
  title: string;
  url: string;
}

interface Props {
  pageUpdates: PageUpdate[];
}

export const PageUpdateDigestEmail = ({ pageUpdates }: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          The following {pageUpdates.length} pages you watch were updated:
        </Text>
        {pageUpdates.map((page, i) => (
          <Text key={i} style={listItem}>
            {'• '}
            <Link href={page.url} style={link}>
              {page.title}
            </Link>
          </Text>
        ))}
      </Section>
    </MailBody>
  );
};

const listItem = {
  ...paragraph,
  margin: '4px 0',
  lineHeight: 1.4,
};

export default PageUpdateDigestEmail;
