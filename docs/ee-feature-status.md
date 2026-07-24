# Status das features Enterprise (EE) neste build

Este fork roda o código **AGPL** do Docmost. O código **Enterprise (EE)** vive
no submódulo git `apps/server/src/ee`, que está **vazio** (não inicializado, por
decisão de deploy). A env `SELF_HOSTED_UNLOCK_FEATURES` libera as *flags* de
feature (destrava a UI e remove os avisos de "upgrade"), mas **não cria** o
código de servidor das features EE — o que depende do `ee/` continua sem backend
e retorna 404 / não tem efeito.

> ⚠️ **Licença:** o código `ee/` está sob a Docmost Enterprise License. Uso em
> produção exige assinatura Enterprise válida. Este documento é o backlog técnico,
> não uma autorização de uso.

## Tela Security (Configurações → Segurança)

| Feature | Status | O que fazia | Realidade neste build | Pendência (o que falta) |
|---|---|---|---|---|
| **Retenção da lixeira** | ✅ Funciona | Dias até limpeza automática de páginas na lixeira | Job AGPL `core/page/services/trash-cleanup.service.ts` roda de verdade | Nada — funcional |
| **Desativar compartilhamento público** | ✅ Funciona | Bloqueia links públicos no workspace | Enforçado em `share.service.ts:394` (AGPL) | Nada — funcional |
| **Exigir MFA** | ❌ Não protege | Forçar 2FA (TOTP) no login | Grava `workspaces.enforce_mfa`, mas o motor de MFA está no `ee` ausente; `auth.controller.ts:73` não carrega e o login passa **sem** o 2º fator (`:108`) | Empacotar o módulo EE de MFA **ou** implementar no AGPL: setup/verify de TOTP, tabela `user_mfa` (já existe migration), e um guard que bloqueie o login quando `enforce_mfa` e MFA não verificado. **Até lá, manter desligado.** |
| **SSO — Google Workspace** | ✅ Funciona | Login via Google (hosted domain) | `core/sso/google-sso` (fork, env-driven `GOOGLE_SSO_*`) | Nada — funcional; provisionar as credenciais quando quiser usar |
| **Exigir SSO** | ⚠️ Parcial | Forçar login por SSO | Flag persiste; só faz sentido com provedor ativo (Google via env) | Só útil junto com um provedor funcional |
| **Provedores SSO customizados (SAML/OIDC/LDAP)** | ❌ Indisponível | CRUD de provedores SSO | `/sso/create\|providers\|update\|delete` estão no `ee` ausente → 404 | Implementar os endpoints `/sso/*` + estratégias SAML/OIDC/LDAP no AGPL, **ou** provisionar o submódulo `ee` com licença |
| **Domínios permitidos (SSO)** | ❌ Indisponível | Restringir SSO a domínios | Depende do SSO customizado | Mesma pendência do SSO customizado |
| **SCIM** | ❌ Indisponível | Provisionamento de usuários/grupos | Sem endpoints `/scim` (só migration + parser de mime) | Implementar controller `/scim` + validação de token SCIM |

## Página License & Edition (Configurações → Licença)

Com o unlock, `tier=enterprise` esconde o painel "Upgrade to Enterprise". O
painel "licenciado" chama `POST /license/info`, que está no `ee` ausente → 404 →
renderiza em branco.

**Pendência:** stub para `/license/*` (info/activate/remove) ou ocultar o painel
licenciado neste build.

## Outras features EE destravadas mas sem backend

Aparecem com o unlock (`*`), mas o motor está no `ee` ausente — cosméticas até
provisionar o submódulo/implementar no AGPL:

- **AI / AI chat** (`ai`)
- **MCP** (`mcp`)
- **Bases** (`bases`)
- **API keys** (`api:keys`)
- **Page permissions** (`page:permissions`)
- **Personal spaces** (`spaces:personal`)
- **Templates de membros** (`templates`) — flag `allowMemberTemplates` é gravada
  mas nunca lida; não há CRUD de templates no AGPL
- **Imports Confluence/DOCX/PDF, page verification, attachment indexing** — idem

## Features do fork que funcionam (AGPL, sem depender do `ee`)

- **Audit log** (`/settings/audit`, owner) — persistência + hash chain + verify +
  export (`integrations/audit/*`)
- **Kanban** (`core/kanban/*`)
- **Google SSO** (`core/sso/google-sso`, env-driven)
- **E-mail/SMTP** com tracing (`integrations/mail/*`)

## Como tornar as features EE realmente funcionais

Duas rotas:

1. **Assinatura Enterprise + provisionar o submódulo `ee`** — inicializar
   `apps/server/src/ee` (e `apps/client/src/ee` server-side equivalente) com o
   código EE oficial e uma chave de licença válida. Resolve tudo de uma vez,
   dentro da licença.
2. **Reimplementar no AGPL** (por feature, conforme necessidade) — ex.: MFA
   (TOTP), endpoints `/sso/*`, `/scim`. Trabalho por feature; sem custo de
   licença EE, mas é reescrever o que o EE já entrega.
