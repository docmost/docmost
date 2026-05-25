import {
  ForbiddenException,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { DashboardPeriodDto } from './dto/dashboard-period.dto';

@Injectable()
export class DashboardService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getOverview() {
    const [
      crsByStatus,
      crsByPriority,
      servicesByLifecycle,
      staleCount,
      devBacklog,
      avgHoursToPublish,
      topRequesters,
      topImplementers,
    ] = await Promise.all([
      this.queryCrsByStatus(),
      this.queryCrsByPriority(),
      this.queryServicesByLifecycle(),
      this.queryStaleServicesCount(),
      this.queryDevBacklog(),
      this.queryAvgHoursToPublish(null),
      this.queryTopRequesters(10),
      this.queryTopImplementers(10),
    ]);

    return {
      crsByStatus,
      crsByPriority,
      servicesByLifecycle,
      staleServices: staleCount,
      devBacklog,
      avgHoursToPublish,
      topRequesters,
      topImplementers,
    };
  }

  async getCrStats(dto: DashboardPeriodDto) {
    const cutoff = this.periodCutoff(dto.period ?? 'month');

    const [opened, published, rejected, cancelled, avgHours] =
      await Promise.all([
        sql<{ count: string }>`
          SELECT COUNT(*) as count FROM change_requests
          WHERE created_at > ${cutoff}
        `.execute(this.db),
        sql<{ count: string }>`
          SELECT COUNT(*) as count FROM change_requests
          WHERE published_at IS NOT NULL AND published_at > ${cutoff}
        `.execute(this.db),
        sql<{ count: string }>`
          SELECT COUNT(*) as count FROM change_requests
          WHERE status = 'REJECTED' AND updated_at > ${cutoff}
        `.execute(this.db),
        sql<{ count: string }>`
          SELECT COUNT(*) as count FROM change_requests
          WHERE status = 'CANCELLED' AND updated_at > ${cutoff}
        `.execute(this.db),
        this.queryAvgHoursToPublish(cutoff),
      ]);

    return {
      period: dto.period ?? 'month',
      opened: Number(opened.rows[0]?.count ?? 0),
      published: Number(published.rows[0]?.count ?? 0),
      rejected: Number(rejected.rows[0]?.count ?? 0),
      cancelled: Number(cancelled.rows[0]?.count ?? 0),
      avgHoursToPublish: avgHours,
    };
  }

  async getMyRequests(authUser: User) {
    const rows = await sql<any>`
      SELECT cr.*,
             s.code  as service_code,
             s.name  as service_name
      FROM change_requests cr
      INNER JOIN services s ON s.id = cr.service_id
      WHERE cr.requested_by_id  = ${authUser.id}
         OR cr.implementer_id   = ${authUser.id}
         OR cr.approver_id      = ${authUser.id}
         OR cr.tech_lead_id     = ${authUser.id}
      ORDER BY cr.updated_at DESC
      LIMIT 50
    `.execute(this.db);

    return rows.rows;
  }

  async exportCrCsv(authUser: User): Promise<StreamableFile> {
    await this.assertAdmin(authUser.id);

    const rows = await sql<any>`
      SELECT
        cr.id,
        cr.title,
        cr.status,
        cr.priority,
        cr.impact,
        cr.justification,
        s.code  as service_code,
        s.name  as service_name,
        u_req.email  as requested_by_email,
        u_imp.email  as implementer_email,
        u_apr.email  as approver_email,
        cr.approved_at,
        cr.published_at,
        cr.closed_at,
        cr.due_date,
        cr.created_at,
        cr.updated_at
      FROM change_requests cr
      INNER JOIN services  s     ON s.id    = cr.service_id
      LEFT  JOIN users     u_req ON u_req.id = cr.requested_by_id
      LEFT  JOIN users     u_imp ON u_imp.id = cr.implementer_id
      LEFT  JOIN users     u_apr ON u_apr.id = cr.approver_id
      ORDER BY cr.created_at DESC
    `.execute(this.db);

    const csv = this.toCsv(rows.rows);
    const buffer = Buffer.from(csv, 'utf-8');
    const filename = `cr-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async queryCrsByStatus() {
    const rows = await sql<{ status: string; count: string }>`
      SELECT status, COUNT(*) as count
      FROM change_requests
      GROUP BY status
      ORDER BY status
    `.execute(this.db);
    return rows.rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  private async queryCrsByPriority() {
    const rows = await sql<{ priority: string; count: string }>`
      SELECT priority, COUNT(*) as count
      FROM change_requests
      GROUP BY priority
      ORDER BY priority
    `.execute(this.db);
    return rows.rows.map((r) => ({
      priority: r.priority,
      count: Number(r.count),
    }));
  }

  private async queryServicesByLifecycle() {
    const rows = await sql<{ lifecycle_state: string; count: string }>`
      SELECT lifecycle_state, COUNT(*) as count
      FROM services
      GROUP BY lifecycle_state
      ORDER BY lifecycle_state
    `.execute(this.db);
    return rows.rows.map((r) => ({
      lifecycleState: r.lifecycle_state,
      count: Number(r.count),
    }));
  }

  private async queryStaleServicesCount(): Promise<number> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const result = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM services s
      WHERE NOT EXISTS (
        SELECT 1 FROM change_requests cr
        WHERE cr.service_id = s.id
          AND cr.published_at IS NOT NULL
          AND cr.published_at > ${cutoff}
      )
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  private async queryDevBacklog() {
    const result = await sql<{
      approved: string;
      in_implementation: string;
      in_verification: string;
    }>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'APPROVED')          as approved,
        COUNT(*) FILTER (WHERE status = 'IN_IMPLEMENTATION') as in_implementation,
        COUNT(*) FILTER (WHERE status = 'IN_VERIFICATION')   as in_verification
      FROM change_requests
      WHERE status IN ('APPROVED', 'IN_IMPLEMENTATION', 'IN_VERIFICATION')
    `.execute(this.db);

    const row = result.rows[0];
    return {
      approved: Number(row?.approved ?? 0),
      inImplementation: Number(row?.in_implementation ?? 0),
      inVerification: Number(row?.in_verification ?? 0),
    };
  }

  private async queryAvgHoursToPublish(since: Date | null): Promise<number | null> {
    const result = since
      ? await sql<{ avg_hours: string | null }>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (published_at - created_at)) / 3600
          ) as avg_hours
          FROM change_requests
          WHERE published_at IS NOT NULL AND published_at > ${since}
        `.execute(this.db)
      : await sql<{ avg_hours: string | null }>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (published_at - created_at)) / 3600
          ) as avg_hours
          FROM change_requests
          WHERE published_at IS NOT NULL
        `.execute(this.db);

    const raw = result.rows[0]?.avg_hours;
    return raw != null ? Math.round(Number(raw) * 10) / 10 : null;
  }

  private async queryTopRequesters(limit: number) {
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      count: string;
    }>`
      SELECT u.id, u.name, u.email, COUNT(cr.id) as count
      FROM change_requests cr
      INNER JOIN users u ON u.id = cr.requested_by_id
      GROUP BY u.id, u.name, u.email
      ORDER BY count DESC
      LIMIT ${limit}
    `.execute(this.db);
    return rows.rows.map((r) => ({ ...r, count: Number(r.count) }));
  }

  private async queryTopImplementers(limit: number) {
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      count: string;
    }>`
      SELECT u.id, u.name, u.email, COUNT(cr.id) as count
      FROM change_requests cr
      INNER JOIN users u ON u.id = cr.implementer_id
      WHERE cr.implementer_id IS NOT NULL
      GROUP BY u.id, u.name, u.email
      ORDER BY count DESC
      LIMIT ${limit}
    `.execute(this.db);
    return rows.rows.map((r) => ({ ...r, count: Number(r.count) }));
  }

  private periodCutoff(period: 'month' | 'quarter' | 'year'): Date {
    const d = new Date();
    if (period === 'quarter') d.setMonth(d.getMonth() - 3);
    else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    return d;
  }

  private toCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v: any): string => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s}"`
        : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ];
    return lines.join('\r\n');
  }

  private async assertAdmin(userId: string): Promise<void> {
    const result = await sql<{ docops_roles: string[] }>`
      SELECT docops_roles FROM users WHERE id = ${userId}
    `.execute(this.db);
    const roles: string[] = result.rows[0]?.docops_roles ?? [];
    if (!roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}
