import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { content, link, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  pageUrl: string;
}

export const PageUpdateEmail = ({
  actorName,
  pageTitle,
  pageUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> updated{' '}
          <Link href={pageUrl} style={link}>
            <strong>{pageTitle}</strong>
          </Link>
          .
        </Text>
      </Section>
      <EmailButton href={pageUrl}>View page</EmailButton>
    </MailBody>
  );
};

export default PageUpdateEmail;
