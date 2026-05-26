import { Section, Text } from 'react-email';
import * as React from 'react';
import { content, paragraph } from '../css/styles';
import { EmailButton, MailBody } from '../partials/partials';

interface Props {
  implementerName: string;
  crTitle: string;
  serviceName: string;
  justification: string;
  crUrl: string;
}

export const CrInVerificationEmail = ({
  implementerName,
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
          <strong>{implementerName}</strong> ha sottomesso per verifica la richiesta
          di modifica <strong>"{crTitle}"</strong> per il servizio{' '}
          <strong>{serviceName}</strong>. È richiesta la tua verifica tecnica.
        </Text>
        <Text style={paragraph}>
          <strong>Motivazione:</strong> {justification}
        </Text>
        <Text style={paragraph}>
          <strong>Prossima azione:</strong> Verifica l'implementazione e approva la pubblicazione oppure richiedi modifiche.
        </Text>
      </Section>
      <EmailButton href={crUrl}>Verifica la richiesta</EmailButton>
    </MailBody>
  );
};

export default CrInVerificationEmail;
