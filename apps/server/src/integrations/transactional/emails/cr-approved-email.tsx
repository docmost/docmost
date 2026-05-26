import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  approverName: string;
  crTitle: string;
  serviceName: string;
  justification: string;
  crUrl: string;
}

export const CrApprovedEmail = ({
  approverName,
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
          <strong>{approverName}</strong> ha approvato la richiesta di modifica{' '}
          <strong>"{crTitle}"</strong> per il servizio <strong>{serviceName}</strong>.
          La richiesta è ora pronta per l'implementazione.
        </Text>
        <Text style={paragraph}>
          <strong>Motivazione originale:</strong> {justification}
        </Text>
        <Text style={paragraph}>
          <strong>Prossima azione (Developer):</strong> Prendi in carico la richiesta e avvia l'implementazione.
        </Text>
      </Section>
      <EmailButton href={crUrl}>Visualizza la richiesta</EmailButton>
    </MailBody>
  );
};

export default CrApprovedEmail;
