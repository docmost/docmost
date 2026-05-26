import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  actorName: string;
  crTitle: string;
  serviceName: string;
  justification: string;
  crUrl: string;
}

export const CrCreatedEmail = ({
  actorName,
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
          <strong>{actorName}</strong> ha sottomesso la richiesta di modifica{' '}
          <strong>"{crTitle}"</strong> per il servizio <strong>{serviceName}</strong>.
          È richiesta la tua approvazione.
        </Text>
        <Text style={paragraph}>
          <strong>Motivazione:</strong> {justification}
        </Text>
        <Text style={paragraph}>
          <strong>Prossima azione:</strong> Accedi alla piattaforma per approvare o rifiutare la richiesta.
        </Text>
      </Section>
      <EmailButton href={crUrl}>Rivedi la richiesta</EmailButton>
    </MailBody>
  );
};

export default CrCreatedEmail;
