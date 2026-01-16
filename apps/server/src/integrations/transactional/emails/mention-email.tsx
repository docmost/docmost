import { Section, Text, Button } from '@react-email/components';
import * as React from 'react';
import { button, content, paragraph } from '../css/styles';
import { MailBody } from '../partials/partials';

interface Props {
  mentionedByName: string;
  pageTitle: string;
  link: string;
  excerpt: string;
  commentSelection?: string | null;
  commentText?: string | null;
}

export const MentionEmail = ({
  mentionedByName,
  pageTitle,
  link,
  excerpt,
  commentSelection,
  commentText,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>
          <strong>{mentionedByName}</strong> mentioned you in <strong>{pageTitle}</strong>.
        </Text>

        {!!excerpt && (
          <Text style={paragraph}>
            <strong>Excerpt:</strong>
            <br />
            {excerpt}
          </Text>
        )}

        {!!commentSelection && (
          <Text style={paragraph}>
            <strong>Commented on:</strong>
            <br />
            {commentSelection}
          </Text>
        )}

        {!!commentText && (
          <Text style={paragraph}>
            <strong>Comment:</strong>
            <br />
            {commentText}
          </Text>
        )}
      </Section>

      <Section
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: '15px',
          paddingBottom: '15px',
        }}
      >
        <Button href={link} style={button}>
          Open page
        </Button>
      </Section>
    </MailBody>
  );
};

export default MentionEmail;


