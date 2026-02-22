# Publish Pipeline Spec

## Overview
Publishing produces an **immutable build** from a **published content version** and a pinned **template + component versions**.

Primary goals:
- Deterministic output
- Idempotent jobs (no duplicate builds)
- Excellent logs + debuggability
- Fast rollback via pointer switching

---

## Key objects
- **Draft site_version**: editable
- **Published site_version**: frozen snapshot for building
- **Build**: immutable artifact in object storage
- **Pointers**:
  - production: `sites.active_build_id`
  - preview: `sites.preview_build_id`

---

## Trigger flows

### A) Publish to production
1) User clicks **Publish**
2) API creates (or updates) a `site_versions` row with `status='published'`
   - common pattern: copy latest draft → new published version
3) Enqueue job `publish_build` with payload:
   - `org_id, site_id, site_version_id, target='production'`

### B) Generate preview build
Same as above but `target='preview'`.

---

## Job: publish_build

### Inputs
- `org_id`
- `site_id`
- `site_version_id`
- `target` = preview | production

### Idempotency
Compute `build_hash = sha256(template_id + template_version + site_version_id + renderer_version)`.

Idempotency key:
- `publish_build:{site_id}:{site_version_id}:{build_hash}:{target}`

If a build exists with the same `site_id/site_version_id/build_hash`, reuse it.

---

## State machine
- QUEUED → BUILDING → SUCCESS | FAILED

All transitions are written to `builds.build_log` and the job log stream.

---

## Steps (detailed)

### Step 1 — Load inputs
- Load `sites` record (pinned template_id/template_version)
- Load `template_versions` + `components` required
- Load `site_versions` + all `pages`

Fail fast with explicit errors if anything is missing.

### Step 2 — Validate
- For each page.sections_json:
  - For each section:
    - Resolve component schema by (component_type, version)
    - Validate `props` against schema

If invalid:
- fail with a structured error payload:
  - page slug
  - section index
  - field path
  - validation message

### Step 3 — Resolve assets
- Verify referenced asset IDs exist and belong to the same org/site
- Optionally enqueue `optimize_asset` jobs for images

If missing assets:
- fail with list of missing asset IDs/paths

### Step 4 — Render (publish-time SSR)
Produce a build directory in worker local disk:
- `/index.html` per route
- `/assets/*` bundles
- `sitemap.xml`, `robots.txt`
- `build_meta.json` (inputs, timestamps, versions)

Renderer MUST be deterministic for same inputs.

### Step 5 — Upload
Upload to object storage under immutable prefix:
- `/sites/{site_id}/builds/{build_id}/...`

Atomic-ish completion:
1) upload all files
2) upload `build_complete.json` **last**

This marker prevents edge serving partial builds.

### Step 6 — Activate pointer
If `target='production'`:
- set `sites.active_build_id = build_id`

If `target='preview'`:
- set `sites.preview_build_id = build_id`

Emit event:
- `SITE_BUILD_ACTIVATED` with `{site_id, build_id, target}`

### Step 7 — Edge cache/KV update
A separate worker/consumer updates edge KV:
- `site:{site_id}:{target}` → `{build_id, storage_prefix}`

This should be event-driven (pub/sub) and retryable.

---

## Retries
Retry policy (suggested):
- Validation failures: **no retry**
- Render failures: 1–2 retries
- Upload failures: 3–5 retries (network)
- KV update failures: retry with backoff; serving can continue using previous pointer

---

## Rollback
Rollback is a pointer swap:
- set `sites.active_build_id` to a previous successful build
- emit `SITE_BUILD_ACTIVATED` again
- update edge KV

No rebuild required.

---

## Logging requirements
Store and surface:
- job attempts + timestamps
- validation errors with precise paths
- renderer version + template versions
- upload progress + final storage prefix
- edge KV update status

Dashboard needs:
- build list
- build logs
- diff inputs (template version, site_version_id)
- one-click rollback
