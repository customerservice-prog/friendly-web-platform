# Recommended Stack (v1)

This stack optimizes for: static-first hosting, fast iteration, strong tenant isolation, cheap global delivery, and operability at 10k+ sites.

## Control Plane (Dashboard + Editor)
- **Next.js (React, TypeScript)**
  - App Router
  - Authenticated dashboard
  - Schema-driven editor UI

## Backend (Control Plane APIs)
- **Node.js + TypeScript**
- Framework: **NestJS** (structured modules, guards, interceptors) *(Fastify is also fine; Nest gives you conventions)*
- API style: **REST** for most endpoints + optional **WebSocket** for live publish status streaming

## Data Stores
- **Postgres** (primary)
  - JSONB for schema-driven content
  - Strong constraints + indexes
- **Redis**
  - Queue backing store
  - Rate limit counters
  - Caching (control plane reads)

## Job System
- **BullMQ** (Redis-backed) + worker containers
  - Idempotency keys
  - Retries + exponential backoff

## Hosting / Data Plane
- **Object storage:** Cloudflare **R2** (S3-compatible) for builds + assets
- **CDN + Edge routing:** **Cloudflare**
  - **Workers** for host → site mapping + build pointer resolution
  - **KV** (or Durable Objects) to store routing maps with fast global reads

## SSL / Domains
- **Let’s Encrypt ACME**
- Challenge: **HTTP-01** via Worker route `/.well-known/acme-challenge/*`
- Certificates terminated at the edge (Cloudflare-managed certs or upload via API depending on plan)

## Observability
- Structured logs (JSON)
- Tracing: OpenTelemetry
- Metrics: Prometheus-compatible (or a managed platform)

## Why Cloudflare-first?
- The hard scaling problem is **routing + SSL + global caching**.
- Cloudflare Workers + KV keeps public traffic off your DB.
- R2 reduces egress surprises and pairs well with CDN.
