# Master Spec — Multi-tenant Website Design + Hosting Platform

## Table of contents
1. Product (PRD)
2. Architecture (TDD)
3. Stack (recommended)
4. Data model (DB schema)
5. Publish pipeline (spec)
6. Domains + SSL (plan)
7. MVP → V1 execution plan (tickets)

---

## 1) Product (PRD)
Source of truth: `PRD.md`

High-level:
- Track A: self-serve (templates + AI in V1)
- Track B: bespoke custom builds running on same platform

MVP proves backbone:
- multi-tenant org/sites
- schema-driven content + editor
- immutable publish pipeline + rollback
- subdomain hosting

V1 adds:
- domains + SSL
- billing
- AI generation
- custom projects/private templates

---

## 2) Architecture (TDD)
Source: `TDD.md`

Core invariants:
- org_id everywhere + enforced
- no DB lookups on public traffic
- immutable builds + pointer switching
- versioned templates/components
- AI outputs schema JSON only

Control plane vs data plane split:
- Control plane: dashboard + APIs + DB + queue
- Data plane: object storage + CDN + edge router + shared public API

---

## 3) Stack (recommended)
Source: `STACK.md`

- Next.js (TS) dashboard/editor
- NestJS (TS) APIs
- Postgres + Redis + BullMQ
- Cloudflare R2 + Workers + KV
- Let’s Encrypt ACME (HTTP-01) *or* Cloudflare-managed certs

---

## 4) Data model (DB schema)
Source: `DB_SCHEMA.md`

Key entities:
- users, orgs, org_members
- templates, template_versions, components
- sites (standard_site | custom_project)
- site_versions (draft/published), pages
- builds (immutable)
- assets
- domains + ssl certs (V1)
- public submissions
- billing
- jobs

---

## 5) Publish pipeline
Source: `PUBLISH_PIPELINE.md`

- Draft → Published version snapshot
- publish_build job validates schema → renders static → uploads to immutable prefix
- pointer switch to active_build_id / preview_build_id
- edge KV updated asynchronously
- rollback = pointer swap

Preview builds recommended for MVP (instead of full staging env).

---

## 6) Domains + SSL
Source: `DOMAIN_SSL_PLAN.md`

- TXT verification required
- DNS checker jobs store rich debug
- SSL provisioning after VERIFIED
- renewal scheduled 30 days before expiry
- edge KV only updated after verification

---

## 7) Execution plan (implementation planning)

### Repo layout (monorepo recommended)
```
/ apps
  / dashboard            # Next.js control plane UI + editor
  / edge-router          # Cloudflare Worker (domain->site->build resolver)
/ services
  / api                  # NestJS API (auth/org, sites, content, publish orchestration)
  / worker               # BullMQ workers (publish_build, dns check, ssl, etc.)
/ packages
  / schemas              # JSON Schemas for components/sections + validators
  / renderer             # Publish-time renderer (SSR to static)
  / shared               # shared types, auth helpers, event contracts
/ infra
  / migrations           # SQL migrations
  / docker               # local dev compose
  / terraform            # optional infra as code
```

### Service boundaries (MVP)
- Dashboard
- API (control plane)
- Worker
- Edge Router

### APIs (MVP endpoints)
Auth/org
- POST /auth/signup, /auth/login
- GET /me
- POST /orgs
- GET /orgs/:orgId
- POST /orgs/:orgId/members

Sites/content
- POST /orgs/:orgId/sites
- GET /orgs/:orgId/sites
- GET /orgs/:orgId/sites/:siteId
- POST /orgs/:orgId/sites/:siteId/draft
- PUT /orgs/:orgId/site-versions/:versionId/pages
- GET /orgs/:orgId/site-versions/:versionId/pages

Publishing
- POST /orgs/:orgId/sites/:siteId/publish (target=preview|production)
- GET /orgs/:orgId/sites/:siteId/builds
- POST /orgs/:orgId/sites/:siteId/rollback

Public API
- POST /public/forms/contact

### Event contracts (internal)
- SITE_BUILD_ACTIVATED {site_id, build_id, target}
- DOMAIN_VERIFIED {domain, site_id}

### Ticket plan (MVP)

#### Sprint 0 — Foundations
1. Monorepo scaffold + tooling (TS, lint, format)
2. Postgres + Redis docker-compose
3. Migration system (prisma/mikro-orm/knex or plain SQL)
4. Base NestJS API service with org-scoped auth guard

#### Sprint 1 — Orgs + Sites + Content
5. Users/orgs/membership + role checks
6. Sites CRUD (multi-site per org)
7. Site versions (draft) + pages CRUD
8. Basic template + component registry tables (seed 1 template)

#### Sprint 2 — Editor (minimal but real)
9. Dashboard: site list + editor shell
10. Page list + section reorder + text edit
11. Media upload (signed URL placeholder, local storage for dev)

#### Sprint 3 — Publish pipeline + hosting (subdomain)
12. Worker: publish_build job (validate → render → upload)
13. Renderer package: schema validation + SSR to static
14. Storage integration (R2/S3) + build_complete marker
15. Edge router Worker: slug.yourplatform.com → active_build
16. Dashboard: publish button + build logs + rollback

#### Sprint 4 — Public forms + abuse controls
17. Public contact form endpoint + DB storage
18. Rate limiting + honeypot

### Ticket plan (V1 highlights)
- Domain add UX + TXT verification + DNS checker jobs
- SSL provisioning + renewal jobs
- Billing (Stripe) + plan gates
- AI wizard + schema generation + per-section regen
- Custom projects/private templates + permissions

### Acceptance criteria (MVP)
- Create org → create site → edit content → publish → view on subdomain
- Publish is logged and rollbackable
- Tenant isolation prevents cross-org access
