import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { z } from 'zod';
import { getPool, initDb } from './db.js';
import { getBearerToken, hashPassword, signToken, verifyPassword, verifyToken } from './auth.js';
import { registerPasswordResetRoutes } from './password-reset.js';

const app = Fastify({ logger: true });
await app.register(sensible);
await app.register(cors, {
  origin: true,
  credentials: true
});

const pool = getPool();
await initDb(pool);

// --- Auth middleware ---
app.decorateRequest('auth', null);

app.addHook('preHandler', async (req) => {
  // Public routes (use req.url because req.routerPath can be undefined in some cases)
  const url = req.url || '';
  if (
    url === '/' ||
    url.startsWith('/health') ||
    url.startsWith('/auth') ||
    url.startsWith('/password-reset')
  )
    return;

  const token = getBearerToken(req);
  if (!token) throw app.httpErrors.unauthorized('Missing bearer token');

  try {
    const payload = verifyToken(token);
    req.auth = payload;
  } catch {
    throw app.httpErrors.unauthorized('Invalid token');
  }
});

// --- Health ---
app.get('/health', async () => ({ ok: true, service: 'api' }));
app.get('/', async () => ({ name: 'friendly-web-platform api', docs: '/health' }));

// --- Password reset (MVP, no email) ---
registerPasswordResetRoutes(app, pool);

// --- Auth routes ---
app.post('/auth/signup', async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      orgName: z.string().min(2)
    })
    .parse(req.body);

  const password_hash = await hashPassword(body.password);

  const client = await pool.connect();
  try {
    await client.query('begin');

    const userRes = await client.query(
      `insert into users (email, password_hash) values ($1, $2)
       on conflict (email) do nothing
       returning id, email, created_at`,
      [body.email.toLowerCase(), password_hash]
    );

    if (userRes.rowCount === 0) {
      throw app.httpErrors.conflict('Email already registered');
    }

    const user = userRes.rows[0];

    const orgRes = await client.query(
      `insert into orgs (name) values ($1) returning id, name, created_at`,
      [body.orgName]
    );
    const org = orgRes.rows[0];

    await client.query(
      `insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`,
      [org.id, user.id]
    );

    await client.query('commit');

    const token = signToken({ user_id: user.id, email: user.email });
    return { token, user, org };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
});

app.post('/auth/login', async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1)
    })
    .parse(req.body);

  const res = await pool.query(`select id, email, password_hash from users where email=$1`, [
    body.email.toLowerCase()
  ]);
  if (res.rowCount === 0) throw app.httpErrors.unauthorized('Invalid email or password');

  const user = res.rows[0];
  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) throw app.httpErrors.unauthorized('Invalid email or password');

  const token = signToken({ user_id: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email } };
});

// --- Orgs ---
app.get('/orgs', async (req) => {
  const userId = req.auth.user_id;
  const res = await pool.query(
    `select o.id, o.name, m.role
     from orgs o
     join org_members m on m.org_id=o.id
     where m.user_id=$1
     order by o.created_at desc`,
    [userId]
  );
  return { orgs: res.rows };
});

app.post('/orgs', async (req) => {
  const userId = req.auth.user_id;
  const body = z.object({ name: z.string().min(2) }).parse(req.body);

  const client = await pool.connect();
  try {
    await client.query('begin');
    const orgRes = await client.query(`insert into orgs (name) values ($1) returning id, name`, [body.name]);
    const org = orgRes.rows[0];
    await client.query(`insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`, [org.id, userId]);
    await client.query('commit');
    return { org };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
});

async function requireOrgMember(userId, orgId) {
  const res = await pool.query(`select role from org_members where org_id=$1 and user_id=$2`, [orgId, userId]);
  if (res.rowCount === 0) throw app.httpErrors.forbidden('Not a member of this org');
  return res.rows[0].role;
}

// --- Sites CRUD ---
app.get('/orgs/:orgId/sites', async (req) => {
  const userId = req.auth.user_id;
  const orgId = req.params.orgId;
  await requireOrgMember(userId, orgId);

  const res = await pool.query(
    `select id, org_id, type, status, name, slug, industry, created_at, updated_at
     from sites
     where org_id=$1
     order by created_at desc`,
    [orgId]
  );
  return { sites: res.rows };
});

app.post('/orgs/:orgId/sites', async (req) => {
  const userId = req.auth.user_id;
  const orgId = req.params.orgId;
  await requireOrgMember(userId, orgId);

  const body = z
    .object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
      industry: z.string().optional(),
      type: z.enum(['standard_site', 'custom_project']).default('standard_site')
    })
    .parse(req.body);

  const res = await pool.query(
    `insert into sites (org_id, type, name, slug, industry)
     values ($1, $2, $3, $4, $5)
     returning id, org_id, type, status, name, slug, industry, created_at, updated_at`,
    [orgId, body.type, body.name, body.slug, body.industry ?? null]
  );
  return { site: res.rows[0] };
});

app.get('/orgs/:orgId/sites/:siteId', async (req) => {
  const userId = req.auth.user_id;
  const { orgId, siteId } = req.params;
  await requireOrgMember(userId, orgId);

  const res = await pool.query(
    `select id, org_id, type, status, name, slug, industry, created_at, updated_at
     from sites
     where org_id=$1 and id=$2`,
    [orgId, siteId]
  );
  if (res.rowCount === 0) throw app.httpErrors.notFound('Site not found');
  return { site: res.rows[0] };
});

app.put('/orgs/:orgId/sites/:siteId', async (req) => {
  const userId = req.auth.user_id;
  const { orgId, siteId } = req.params;
  await requireOrgMember(userId, orgId);

  const body = z
    .object({
      name: z.string().min(2).optional(),
      industry: z.string().optional(),
      status: z.enum(['active', 'suspended']).optional()
    })
    .parse(req.body);

  const res = await pool.query(
    `update sites
     set name=coalesce($3, name),
         industry=coalesce($4, industry),
         status=coalesce($5, status),
         updated_at=now()
     where org_id=$1 and id=$2
     returning id, org_id, type, status, name, slug, industry, created_at, updated_at`,
    [orgId, siteId, body.name ?? null, body.industry ?? null, body.status ?? null]
  );

  if (res.rowCount === 0) throw app.httpErrors.notFound('Site not found');
  return { site: res.rows[0] };
});

app.delete('/orgs/:orgId/sites/:siteId', async (req) => {
  const userId = req.auth.user_id;
  const { orgId, siteId } = req.params;
  const role = await requireOrgMember(userId, orgId);
  if (role !== 'owner' && role !== 'admin') throw app.httpErrors.forbidden('Insufficient role');

  const res = await pool.query(`delete from sites where org_id=$1 and id=$2`, [orgId, siteId]);
  if (res.rowCount === 0) throw app.httpErrors.notFound('Site not found');
  return { ok: true };
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
