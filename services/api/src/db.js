import pg from 'pg';

const { Pool } = pg;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  // Render provides a connection string; SSL is typically required.
  const ssl = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false };

  return new Pool({ connectionString, ssl });
}

export async function initDb(pool) {
  // Minimal "migrations" for MVP. Later replace with a real migration tool.
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists orgs (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists org_members (
      org_id uuid not null references orgs(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      role text not null,
      created_at timestamptz not null default now(),
      primary key (org_id, user_id)
    );

    create table if not exists sites (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references orgs(id) on delete cascade,
      type text not null,
      status text not null default 'active',
      name text not null,
      slug text not null,
      industry text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (org_id, slug)
    );

    create index if not exists idx_sites_org_id on sites(org_id);

    create table if not exists password_reset_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      token text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_password_reset_tokens_user_id on password_reset_tokens(user_id);
  `);
}
