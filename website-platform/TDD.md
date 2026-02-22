# Technical Design Doc — Multi-tenant Website Design + Hosting Platform

## 0) Goals
Build a platform that supports:
- **Track A:** self-serve AI-generated websites at mass scale
- **Track B:** bespoke “from scratch” custom builds, still running on the same platform

Key outcomes:
- Serve **10,000+** sites without per-site servers
- **Publishing is the expensive step**, not traffic
- Strong **tenant isolation** everywhere
- Reliable, logged, rollbackable publishing

## 1) Core invariants (non-negotiable)
1. **Every record is scoped by org_id (tenant_id).**
2. **No public request performs a DB lookup.** Public traffic uses edge KV/cache.
3. **Every published build is immutable** (content + template version + renderer version are part of the build input).
4. **Activation is a pointer switch** (active_build_id), enabling instant rollback.
5. **Templates/components are versioned; sites pin versions** until explicit migration.
6. AI outputs **schema-valid JSON**, never HTML.

## 2) High-level architecture

### Control Plane (SaaS)
- **Dashboard Web App** (Next.js)
- **API Services** (Node/NestJS)
  - Auth/Org/Roles
  - Sites/Projects
  - Templates/Components registry
  - Content (draft/published)
  - Assets (uploads, transforms)
  - Publishing Orchestrator (enqueue jobs)
  - Domains/SSL (lifecycle state + jobs)
  - Billing (Stripe)
  - Admin/Support (audited)

### Data Plane (public web)
- **Object Storage (R2/S3)**: assets + build artifacts
- **CDN**: serves static builds globally
- **Edge Router (Cloudflare Worker)**:
  - Maps `Host` → `site_id` → `active_build_path`
  - Serves build files from storage origin/CDN
- **Shared Public API** (contact forms, booking requests, etc.)
  - Rate limited and anti-spam

## 3) Public request path (runtime serving)
Request: `GET https://www.client.com/services`
1) Worker reads `Host` header
2) Worker looks up host mapping in KV:
   - `domain:www.client.com -> { site_id }`
3) Worker looks up build pointer in KV:
   - `site:{site_id}:active -> { build_id, storage_prefix }`
4) Worker fetches `${storage_prefix}/services/index.html` from R2 via CDN/origin
5) Return cached response

Notes:
- Build output uses **versioned paths** so cache invalidation is mostly unnecessary.
- Worker returns helpful errors for unmapped domains (controlled).

## 4) Multi-tenancy model
- Primary tenant: **org**
- A user can belong to multiple orgs via org_members
- All tables that represent tenant-owned objects have **org_id**

Enforcement layers:
- Service-layer authorization (NestJS guards)
- Mandatory query scoping by org_id
- Optional future hardening: Postgres Row Level Security (RLS)

## 5) Site / Project model
- **Site** is the serving unit (has builds, domains)
- Two site types:
  - `standard_site` (template-based)
  - `custom_project` (private template + possibly extended component registry)

Decision already locked:
- For bespoke sites, clients get **text/media edits only** (field-level permissions, locked structure).

## 6) Content model (schema-driven)
Content is stored as structured JSON.

### Draft vs published
- Draft content is editable.
- Published content is a frozen snapshot used for builds.

### Page model
- A site version contains pages.
- Each page contains an **ordered list of sections**.
- Each section:
  - `type` (component key)
  - `version` (component version)
  - `props` (JSON validated by schema)
  - `styleTokens` (theme references)

## 7) Template + component registry

### Templates
- Template = a curated set of pages/sections + theme defaults + allowed section palette.
- Templates are versioned.

### Components
- Components are versioned.
- Each component includes:
  - JSON Schema for props validation
  - Editor UI config (labels, widgets, constraints)
  - Permissions config (client-editable fields)
  - Renderer implementation (React SSR component)

## 8) Rendering strategy (publish-time SSR to static)
At publish time:
- Load template version + component registry
- Validate all content props against component schemas
- Render each page route → static HTML
- Emit static assets:
  - CSS bundle
  - JS bundle (minimal; optional hydration)
  - sitemap.xml, robots.txt
- Upload to storage under immutable path

## 9) Publishing orchestrator + jobs
Publishing is done by background workers.

Job types (minimum set):
- `publish_build`
- `optimize_asset` (optional MVP)
- `verify_domain_dns` (V1)
- `provision_ssl` (V1)
- `renew_ssl` (V1)

Properties:
- Jobs are **idempotent**.
- Job logs are stored and shown in the dashboard.

## 10) Preview builds vs staging (recommended)
MVP approach:
- Support **preview builds** without introducing a separate staging environment.

Data model:
- `sites.active_build_id` (production)
- `sites.preview_build_id` (latest preview)

Preview URLs:
- Option A: `preview--{slug}.yourplatform.com`
- Option B: signed preview token on main subdomain

## 11) Domains + SSL (V1)
- Domain lifecycle states:
  - PENDING_DNS → VERIFIED → SSL_PROVISIONING → ACTIVE (or ERROR)
- Verification via TXT token
- ACME (Let’s Encrypt) with HTTP-01 via Worker route `/.well-known/acme-challenge/*`

## 12) Security controls
- Strict org scoping on every query
- Signed URLs for direct-to-storage uploads
- WAF / bot protection at edge
- Rate limiting for public APIs
- Audit logs for admin actions (esp. impersonation)
- Encryption for secrets (webhook secrets, API keys)

## 13) Observability / operations
- Publish job logs stored per build
- Domain/SSL debug logs stored per domain
- Metrics:
  - publish success rate
  - publish duration (p50/p95)
  - domain verification success rate
  - SSL provisioning error rate
- Tracing across API → queue → worker

## 14) Next design artifacts (this repo)
- DB schema v1 (see `DB_SCHEMA.md`)
- Publish pipeline spec (see `PUBLISH_PIPELINE.md`)
