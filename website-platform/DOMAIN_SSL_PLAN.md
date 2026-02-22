# Domain + SSL Implementation Plan (Cloudflare-first)

## Goals
- Support thousands of custom domains with minimal support load.
- Domain ownership verification must be secure (no hijacking).
- SSL issuance + renewal must be automated, observable, and debuggable.
- Public traffic must not hit the database.

---

## Supported hostnames
- Platform subdomain (always available):
  - `{slug}.yourplatform.com`
- Custom domains:
  - `www.client.com` (recommended)
  - `client.com` (apex) (optional)

Recommendation: encourage `www` as primary and optionally redirect apex → www.

---

## Data model (recap)
- `site_domains`:
  - domain, status, verification_token, debug_json, error_message
- `ssl_certs`:
  - not_after, renewal_due_at, status, debug_json

Domain statuses:
- PENDING_DNS → VERIFIED → SSL_PROVISIONING → ACTIVE
- ERROR (terminal until user action or retry)

---

## UX: Add domain flow
1) User enters domain(s):
   - `www.client.com` and optionally `client.com`
2) System creates `site_domains` records with:
   - `verification_token` (random, long)
   - status = `pending_dns`
3) UI shows DNS instructions (copyable):

### Verification (TXT) — required
Preferred record (example):
- Name: `_verify.www.client.com`
- Type: `TXT`
- Value: `{token}`

Alternate (simpler for users):
- Name: `_verify.client.com`
- Type: `TXT`
- Value: `{token}`

Pick one convention and keep it consistent; store the expected FQDN in `debug_json.expected_txt_name`.

### Routing record
For `www`:
- Type: `CNAME`
- Name: `www`
- Target: `edge.yourplatform.com`

For apex:
- Prefer: `ALIAS/ANAME` to `edge.yourplatform.com` if registrar supports
- Fallback: user sets an `A` record to a stable Anycast IP (only if you truly have stable IPs)
- Best fallback: tell them to redirect apex → www

4) CTA button: **“Check DNS”** (manual) plus background polling.

---

## Verification method
### Why TXT verification
- Prevents domain hijacking by someone who can point DNS but doesn’t own it.
- Lets you gate SSL issuance safely.

### Verification logic
A `verify_domain_dns` job:
- Resolves TXT records for `expected_txt_name`
- Compares against stored token

On success:
- status → `verified`
- enqueue `provision_ssl`

On failure:
- keep `pending_dns`
- store rich debug:
  - resolved TXT values
  - last resolver used
  - timestamp
  - hints (propagation)

---

## DNS checker worker
Job scheduling:
- Run immediately after domain add
- Then every N minutes (e.g., 5) until verified, with max window (e.g., 48h)
- Also on user “Check DNS” click (force run)

Store in `site_domains.debug_json`:
- `expected_txt_name`
- `expected_token`
- `observed_txt_values[]`
- `observed_cname_chain[]` (for www)
- `last_checked_at`
- `resolver`

This is what makes support *not hell*.

---

## SSL provisioning

Two viable Cloudflare-first options:

### Option A (simplest): Cloudflare-managed certificates (recommended if available)
- You route the domain through Cloudflare.
- Cloudflare issues/renews certs automatically.
- Your job system still tracks status and provides debug, but issuance is handled by Cloudflare.

Pros: easiest ops.
Cons: depends on Cloudflare zone setup and plan.

### Option B: Let’s Encrypt ACME HTTP-01 via Worker (works even without full zone control)
Process:
1) After VERIFIED, create an `ssl_certs` row status=provisioning.
2) ACME service requests HTTP-01 challenge.
3) Store challenge token in a shared store (KV or DB).
4) Edge Worker serves:
   - `/.well-known/acme-challenge/{token}` → `{keyAuthorization}`
5) ACME validates and issues cert.
6) Cert is uploaded/attached to edge termination (provider-specific).
7) status → active.

Important: keep challenge storage global and fast. If Worker uses KV, include cache headers carefully.

---

## Renewal
- Compute `renewal_due_at = not_after - 30 days`
- Nightly cron/worker scans for due renewals and enqueues `renew_ssl`
- On failure, retry with backoff and alert internally

---

## Edge routing mechanics
At request time (no DB):
- `host → site_id` from KV
- `site_id → active_build` from KV

KV keys (example):
- `domain:{host}` → `{ site_id }`
- `site:{site_id}:active` → `{ build_id, storage_prefix }`
- `site:{site_id}:preview` → `{ build_id, storage_prefix }`

Update strategy:
- Control plane emits events on:
  - domain verified/removed
  - build activated
- A consumer updates KV.

KV TTL:
- Domain mappings: long TTL (but update via events)
- Build pointers: long TTL

---

## Apex handling recommendations
- Strongly encourage `www` as canonical.
- Provide a toggle: “Redirect apex to www”
- Implement redirect at edge if you receive apex traffic.

---

## Failure modes (and how we surface them)

### DNS verification failures
- TXT record not found
- Token mismatch
- Propagation delay

UI shows:
- expected record
- observed records
- last checked

### SSL failures
- ACME error codes
- Challenge not reachable
- Rate limiting

UI shows:
- exact ACME error
- last successful validation timestamp

---

## Security notes
- Require TXT verification before mapping domain → site_id in KV.
- Rate limit “Check DNS” button.
- Audit admin actions affecting domains.
- Prevent domain reuse across orgs unless explicitly transferred with re-verification.
