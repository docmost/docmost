import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  crTitle: string;
  serviceName: string;
  justification: string;
  crUrl: string;
}

export const CrPublishedEmail = ({
  crTitle,
  serviceName,
  justification,
  crUrl,
}: Props) => {
  return (
    <MailBody>
      <Section style={content}>
        <Text style={paragraph}>Ciao,</Text>
        <Text style={paragraph}>
          La richiesta di modifica <strong>"{crTitle}"</strong> per il servizio{' '}
          <strong>{serviceName}</strong> è stata pubblicata. La documentazione del
          servizio è stata aggiornata.
        </Text>
        <Text style={paragraph}>
          <strong>Motivazione:</strong> {justification}
        </Text>
      </Section>
      <EmailButton href={crUrl}>Visualizza la richiesta</EmailButton>
    </MailBody>
  );
};

export default CrPublishedEmail;
