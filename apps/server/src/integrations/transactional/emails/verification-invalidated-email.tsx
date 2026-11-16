import { Section, Text } from '../components';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  pageTitle: string;
  spaceName: string;
  pageUrl: string;
  verificationType: string;
  previousStatus: string;
}

export const VerificationInvalidatedEmail = ({
  actorName,
  pageTitle,
  spaceName,
  pageUrl,
  verificationType,
  previousStatus,
}: Props) => {
  const isQms = verificationType === 'qms';
  const wasInApproval = isQms && previousStatus === 'in_approval';

  let outcome = 'Its verification was removed until it is verified again.';
  if (wasInApproval) {
    outcome =
      'The approval request was withdrawn and the page is back in draft.';
  } else if (isQms) {
    outcome = 'It is back in draft and needs to be approved again.';
  }

  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Hi there,</Text>
        <Text style={paragraph}>
          <strong>{actorName}</strong> changed <strong>{pageTitle}</strong> in
          the <strong>{spaceName}</strong> space
          {wasInApproval ? ' while it was in approval.' : '.'} {outcome}
        </Text>
      </Section>
      <EmailButton href={pageUrl}>Review page</EmailButton>
    </MailBody>
  );
};

export default VerificationInvalidatedEmail;
