import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import * as React from 'react';
import { MailService } from '../../integrations/mail/mail.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CrCreatedEmail } from '../../integrations/transactional/emails/cr-created-email';
import { CrApprovedEmail } from '../../integrations/transactional/emails/cr-approved-email';
import { CrInVerificationEmail } from '../../integrations/transactional/emails/cr-in-verification-email';
import { CrPublishedEmail } from '../../integrations/transactional/emails/cr-published-email';
import {
  DOCOPS_CR_EMAIL_QUEUE,
  CR_NOTIFY_EMAIL_JOB,
  CrNotifyEmailJobData,
} from './cr-notify-email.constants';

@Processor(DOCOPS_CR_EMAIL_QUEUE)
export class CrNotifyEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(CrNotifyEmailProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly mailService: MailService,
    private readonly environmentService: EnvironmentService,
  ) {
    super();
  }

  async process(job: Job<CrNotifyEmailJobData>): Promise<void> {
    if (job.name !== CR_NOTIFY_EMAIL_JOB) return;

    const { action, crId, crData, actorName } = job.data;
    const appUrl = this.environmentService.getAppUrl();
    const crUrl = `${appUrl}/change-requests/${crId}`;

    const serviceRow = await sql<{ name: string }>`
      SELECT name FROM services WHERE id = ${crData.serviceId}
    `.execute(this.db);
    const serviceName = serviceRow.rows[0]?.name ?? 'Servizio sconosciuto';

    if (action === 'submit') {
      const recipients = await sql<{ email: string }>`
        SELECT email FROM users
        WHERE docops_roles @> ARRAY['APPROVER']::text[]
        AND deleted_at IS NULL
      `.execute(this.db);

      for (const r of recipients.rows) {
        await this.mailService.sendToQueue({
          to: r.email,
          subject: `[DocOps] Nuova richiesta di modifica: ${crData.title}`,
          template: React.createElement(CrCreatedEmail, {
            actorName,
            crTitle: crData.title ?? crId,
            serviceName,
            justification: crData.justification ?? '',
            crUrl,
          }),
        });
      }
      return;
    }

    if (action === 'approve') {
      const richiedenteRow = await sql<{ email: string }>`
        SELECT email FROM users WHERE id = ${crData.requestedById} AND deleted_at IS NULL
      `.execute(this.db);

      const developerRows = await sql<{ email: string }>`
        SELECT email FROM users
        WHERE docops_roles @> ARRAY['DEVELOPER']::text[]
        AND deleted_at IS NULL
      `.execute(this.db);

      const seen = new Set<string>();
      for (const r of [...richiedenteRow.rows, ...developerRows.rows]) {
        if (seen.has(r.email)) continue;
        seen.add(r.email);
        await this.mailService.sendToQueue({
          to: r.email,
          subject: `[DocOps] Richiesta approvata: ${crData.title}`,
          template: React.createElement(CrApprovedEmail, {
            approverName: actorName,
            crTitle: crData.title ?? crId,
            serviceName,
            justification: crData.justification ?? '',
            crUrl,
          }),
        });
      }
      return;
    }

    if (action === 'submit_for_verification') {
      const recipients = await sql<{ email: string }>`
        SELECT email FROM users
        WHERE docops_roles @> ARRAY['TECH_LEAD']::text[]
        AND deleted_at IS NULL
      `.execute(this.db);

      for (const r of recipients.rows) {
        await this.mailService.sendToQueue({
          to: r.email,
          subject: `[DocOps] CR pronta per verifica: ${crData.title}`,
          template: React.createElement(CrInVerificationEmail, {
            implementerName: actorName,
            crTitle: crData.title ?? crId,
            serviceName,
            justification: crData.justification ?? '',
            crUrl,
          }),
        });
      }
      return;
    }

    if (action === 'publish') {
      const serviceOwnerRow = await sql<{ email: string }>`
        SELECT u.email
        FROM services s
        JOIN users u ON u.id = s.owner_id
        WHERE s.id = ${crData.serviceId}
          AND u.deleted_at IS NULL
      `.execute(this.db);

      const richiedenteRow = await sql<{ email: string }>`
        SELECT email FROM users WHERE id = ${crData.requestedById} AND deleted_at IS NULL
      `.execute(this.db);

      const seen = new Set<string>();
      for (const r of [...richiedenteRow.rows, ...serviceOwnerRow.rows]) {
        if (seen.has(r.email)) continue;
        seen.add(r.email);
        await this.mailService.sendToQueue({
          to: r.email,
          subject: `[DocOps] Richiesta pubblicata: ${crData.title}`,
          template: React.createElement(CrPublishedEmail, {
            crTitle: crData.title ?? crId,
            serviceName,
            justification: crData.justification ?? '',
            crUrl,
          }),
        });
      }
    }
  }
}
