# Database Schema v1 (Postgres)

This is a starter schema optimized for multi-tenant isolation + schema-driven content + immutable builds.

Conventions:
- Primary keys: `uuid`
- All tenant-owned tables include `org_id`
- Prefer `created_at`, `updated_at`
- JSONB used for schema-based content and UI config

## Enums
- `org_role`: owner, admin, editor, viewer
- `site_type`: standard_site, custom_project
- `site_status`: active, suspended
- `version_status`: draft, published
- `build_status`: queued, building, success, failed
- `domain_status`: pending_dns, verified, ssl_provisioning, active, error
- `ssl_status`: provisioning, active, error, expired
- `job_status`: queued, running, success, failed

---

## 1) Auth + Orgs

### users
- id uuid pk
- email text unique not null
- password_hash text null (if using magic links / external auth)
- created_at timestamptz not null

### orgs
- id uuid pk
- name text not null
- created_at timestamptz not null

### org_members
- org_id uuid fk → orgs.id
- user_id uuid fk → users.id
- role org_role not null
- created_at timestamptz not null
- **unique (org_id, user_id)**

Indexes:
- org_members(user_id)

---

## 2) Templates + Components

### templates
- id uuid pk
- name text not null
- industry text null
- visibility text not null  -- 'public' | 'private'
- owner_org_id uuid null fk → orgs.id  -- for private templates
- created_at timestamptz not null

Indexes:
- templates(industry)

### template_versions
- id uuid pk
- template_id uuid not null fk → templates.id
- version int not null
- schema_json jsonb not null           -- overall template schema + allowed sections
- editor_config_json jsonb not null    -- wizard/editor UI hints
- created_at timestamptz not null
- **unique (template_id, version)**

### components
Component registry entries.
- id uuid pk
- template_id uuid not null fk → templates.id
- component_type text not null         -- e.g. 'hero'
- version int not null                 -- integer semver-ish
- schema_json jsonb not null           -- JSON schema for props
- editor_config_json jsonb not null
- permissions_json jsonb not null      -- which fields client can edit
- created_at timestamptz not null
- **unique (template_id, component_type, version)**

---

## 3) Sites / Projects

### sites
- id uuid pk
- org_id uuid not null fk → orgs.id
- type site_type not null
- status site_status not null default 'active'
- name text not null
- slug text not null                   -- used for subdomain routing
- industry text null
- template_id uuid null fk → templates.id
- template_version int null
- active_build_id uuid null fk → builds.id
- preview_build_id uuid null fk → builds.id
- created_at timestamptz not null
- updated_at timestamptz not null

Constraints:
- **unique (org_id, slug)**

Indexes:
- sites(org_id)
- sites(slug)

---

## 4) Content versioning

### site_versions
Represents a snapshot of a site’s content at a point in time.
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_id uuid not null fk → sites.id
- status version_status not null       -- draft/published
- content_root_json jsonb not null     -- theme tokens, nav, footer, global settings
- ai_metadata_json jsonb null          -- provenance, brand voice, etc.
- created_at timestamptz not null

Indexes:
- site_versions(site_id, status)

### pages
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_version_id uuid not null fk → site_versions.id
- slug text not null
- title text not null
- sections_json jsonb not null         -- ordered list of {type, version, props, styleTokens}
- seo_json jsonb not null default '{}'::jsonb
- created_at timestamptz not null
- **unique (site_version_id, slug)**

Indexes:
- pages(site_version_id)

---

## 5) Builds

### builds
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_id uuid not null fk → sites.id
- site_version_id uuid not null fk → site_versions.id
- build_hash text not null             -- hash of inputs for idempotency
- storage_prefix text not null         -- e.g. /sites/{site_id}/builds/{build_id}
- status build_status not null
- build_log jsonb not null default '{}'::jsonb
- created_at timestamptz not null
- updated_at timestamptz not null

Constraints:
- **unique (site_id, site_version_id, build_hash)**

Indexes:
- builds(site_id)
- builds(site_version_id)

---

## 6) Assets

### assets
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_id uuid null fk → sites.id
- type text not null                   -- image/video/doc
- storage_key text not null            -- object storage key
- metadata_json jsonb not null         -- width/height/format, etc.
- created_at timestamptz not null

Indexes:
- assets(org_id)
- assets(site_id)

---

## 7) Domains + SSL (V1)

### site_domains
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_id uuid not null fk → sites.id
- domain text not null
- status domain_status not null
- verification_token text not null
- last_checked_at timestamptz null
- error_message text null
- debug_json jsonb not null default '{}'::jsonb  -- resolved TXT/CNAME, etc.
- created_at timestamptz not null
- **unique (domain)**

### ssl_certs
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_domain_id uuid not null fk → site_domains.id
- provider text not null               -- lets_encrypt
- status ssl_status not null
- not_before timestamptz null
- not_after timestamptz null
- renewal_due_at timestamptz null
- error_message text null
- debug_json jsonb not null default '{}'::jsonb
- created_at timestamptz not null

---

## 8) Public submissions (forms)

### form_submissions
- id uuid pk
- org_id uuid not null fk → orgs.id
- site_id uuid not null fk → sites.id
- form_type text not null              -- contact/booking/newsletter
- payload_json jsonb not null
- ip_hash text null
- user_agent text null
- created_at timestamptz not null

Indexes:
- form_submissions(site_id, created_at desc)

---

## 9) Billing (V1)

### subscriptions
- id uuid pk
- org_id uuid not null unique fk → orgs.id
- stripe_customer_id text not null
- stripe_subscription_id text not null
- plan text not null
- status text not null                 -- active/past_due/canceled
- current_period_end timestamptz null
- created_at timestamptz not null

---

## 10) Jobs

### jobs
- id uuid pk
- org_id uuid not null fk → orgs.id
- type text not null                   -- publish_build, verify_dns, provision_ssl, etc.
- site_id uuid null
- payload_json jsonb not null
- status job_status not null
- attempts int not null default 0
- idempotency_key text not null
- last_error text null
- run_after timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null

Constraints:
- **unique (idempotency_key)**

Indexes:
- jobs(status, run_after)

---

## Tenant isolation notes
- In v1, enforce isolation in service layer + strict query scoping by org_id.
- Future upgrade: enable Postgres RLS for the most sensitive tables.
