# Product Requirements Document (PRD)

## 1) Product summary
A multi-tenant **Website Design + Hosting Platform** supporting:
- **Track A:** Self-serve AI Website Factory (mass scale)
- **Track B:** From-scratch custom builds (bespoke, high value) that still run on the same platform

Publishing creates immutable static builds served via CDN. Multi-tenancy is strict.

---

## 2) Problem statement
Small businesses and creators want modern websites without agency cost or technical hassle. Agencies and internal teams need a scalable way to deliver bespoke builds without creating one-off infrastructure.

---

## 3) Target users
### Primary
- Local business owners (restaurants, salons, car washes, etc.)
- Creators (musicians, etc.)

### Internal
- Designers
- Engineers
- Support/admin staff

---

## 4) User goals
### Customers
- Get a high-quality website live quickly
- Edit content safely without breaking layout
- Connect a custom domain with automatic SSL

### Internal team
- Build custom sites within platform constraints
- Ship bespoke components without creating a parallel hosting system
- Debug publish/domain issues quickly via logs

---

## 5) Non-negotiable requirements
- Static-first hosting via CDN + object storage
- Immutable builds + pointer switching + rollback
- Strict tenant isolation (org_id everywhere, enforced in every query)
- AI generation outputs schema-valid JSON (never raw HTML)
- Publishing is expensive; page views are cheap

---

## 6) Product scope

### MVP (Phase 1–2)
Customer-facing:
- Signup/login
- Create organization
- Multi-site per org
- Create site from a template
- Draft content stored as structured JSON
- Schema-driven editor (text/images/pages + section reorder)
- Publish pipeline → immutable build
- Hosting on platform subdomain `{slug}.yourplatform.com`
- One shared public API: contact form

Internal/admin:
- View orgs/sites
- View build/publish logs
- Re-run publish
- Rollback to previous build
- Suspend tenant/site for abuse

### V1 (post-MVP)
- Custom domains + SSL automation
- Billing (Stripe subscriptions)
- AI interview wizard + schema-aware generation + regen controls
- Private templates + custom projects (internal)
- Field-level permissions + locked sections for bespoke sites
- Observability hardening + alerting

Out of scope initially:
- Full ecommerce
- Full blogging CMS workflows
- Membership/community features

---

## 7) Functional requirements

### 7.1 Auth & organizations
- User can create an org
- User can belong to multiple orgs
- Roles: owner/admin/editor/viewer

### 7.2 Site creation
- User can create multiple sites under an org
- Choose industry and goals
- Choose a template (MVP: manual; V1: auto-suggest)

### 7.3 Content model
- Content is structured JSON
- Pages: slug/title + ordered sections
- Sections validated by JSON Schema

### 7.4 Editor
Two modes long-term; MVP starts with block editor.

MVP editor:
- Add/remove/reorder sections
- Edit text + images
- Page management (add/rename/reorder)
- Basic theme tokens

Bespoke constraint (locked decision):
- Custom builds: client can edit **text/media only**; structure locked unless internal enables.

### 7.5 Publishing
- Publish produces immutable build
- Build logs stored and visible
- Activation swaps pointer
- Rollback swaps pointer back
- Publish is idempotent

### 7.6 Hosting
- Static output served via CDN
- Assets served from object storage + CDN
- Public APIs handle dynamic actions (forms)

### 7.7 Domains + SSL (V1)
- Add domain
- TXT verification
- Automated SSL issuance + renewal
- Clear status + failure reasons

### 7.8 AI generation (V1)
- Wizard collects business inputs
- AI generates schema-valid JSON for:
  - pages/sections
  - copy blocks
  - SEO titles/metas
  - imagery prompts
- Validation + auto-repair loop
- Per-section regeneration
- AI provenance metadata stored
- Never publish without human confirmation

### 7.9 Custom projects (V1)
- Internal-only template builder + component registry
- Private templates per client
- Locked sections + field-level permissions
- Preview/QA flow

---

## 8) Non-functional requirements
- Tenant isolation and access control
- 99.9% uptime target for serving published sites (CDN)
- Publish success rate > 99%
- Low TTFB globally
- Rate limiting + anti-spam on forms
- Audit logging for admin actions
- Backups (Postgres PITR) + storage durability

---

## 9) Key user flows

### Flow A — Self-serve (MVP → V1)
1) Signup → create org
2) Create site → choose template
3) Edit draft content
4) Publish
5) Share subdomain URL

(V1 adds AI wizard before editor + domains + billing.)

### Flow B — Custom builds (V1)
1) Sales/admin creates custom project under client org
2) Internal designer/engineer builds private template/components
3) QA via preview builds
4) Publish to production
5) Client gets limited editor permissions (text/media)

---

## 10) Success metrics
- Median time to first publish (self-serve) < 15 minutes (V1 with AI)
- Domain connection success rate > 90% without support
- Publish success rate > 99%
- Support tickets per 100 sites decreases over time

---

## 11) Risks & mitigations
- Domain/SSL edge cases → rich debug UI + robust retry jobs
- AI hallucinations → review required + provenance + scoped regen
- Template migrations breaking sites → pinned versions + explicit migrations only
- Form spam/abuse → rate limiting, honeypots, optional captcha

---

## 12) Milestones (implementation order)
1) MVP backbone: auth/org, templates, content JSON, editor, publish → subdomain hosting
2) Versioning + rollback maturity
3) Domains + SSL
4) Billing
5) AI generation
6) Custom projects + private templates
7) Scale hardening (edge KV, image pipeline, autoscaling workers, alerting)
