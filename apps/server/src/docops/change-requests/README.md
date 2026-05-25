# DocOps — Change Requests Module (Backend)

NestJS module for Change Request workflow (8 canonical states).

Spec: §3.3, §6 — Modulo Workflow Change Request.
Entities: `change_requests`, `change_request_events`, `external_refs`.
API: `POST/GET/PATCH /api/v1/change-requests`, `/api/v1/change-requests/:id/transition`.
States: DRAFT → REQUESTED → IN_REVIEW → APPROVED → IN_IMPLEMENTATION → IN_VERIFICATION → PUBLISHED → CLOSED.
Terminal: REJECTED, CANCELLED.
