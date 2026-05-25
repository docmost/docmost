# DocOps — Webhooks Module (Backend)

NestJS module for outbound CI/CD webhooks.

Spec: §3.12, §10.1 — Modulo API REST + Webhook outbound.
Entity: `webhooks_config`.
Events: `cr.approved`, `cr.in_implementation`, `cr.published`.
Payload signed HMAC-SHA256.
