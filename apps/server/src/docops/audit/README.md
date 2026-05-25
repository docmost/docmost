# DocOps — Audit Module (Backend)

NestJS module for extended audit logging.

Spec: §3.13 — Modulo Audit log.
Entity: `audit_logs`.
Append-only. Retention configurabile (default 5 anni).
API: `POST /api/v1/audit` (query filtrabile, solo Admin).
