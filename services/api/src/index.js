import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { z } from 'zod';
import { getPool, initDb } from './db.js';
import { getBearerToken, hashPassword, signToken, verifyPassword, verifyToken } from './auth.js';
import { registerPasswordResetRoutes } from './password-reset.js';
import { verifyGitHubWebhook } from './github-webhook.js';
import { getInstallationOctokit } from './github-app.js';
import rawBody from 'fastify-raw-body';

const app = Fastify({ logger: true });
await app.register(sensible);

// Needed so we can verify GitHub webhooks.
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: false,
  runFirst: true
});

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

// --- GitHub App webhook (installation tracking) ---
app.post('/integrations/github/webhook', { config: { rawBody: true } }, async (req) => {
  const ok = await verifyGitHubWebhook(req);
  if (!ok) throw app.httpErrors.unauthorized('Invalid webhook signature');

  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];
  const payload = req.body;

  // We primarily care about installation created/deleted.
  if (event === 'installation') {
    const action = payload.action;
    const installationId = payload.installation?.id;
    const accountLogin = payload.installation?.account?.login;
    const accountType = payload.installation?.account?.type;

    if (installationId && accountLogin && accountType) {
      if (action === 'created') {
        await pool.query(
          `insert into github_installations (installation_id, account_login, account_type)
           values ($1, $2, $3)
           on conflict (installation_id) do update set
             account_login=excluded.account_login,
             account_type=excluded.account_type,
             updated_at=now()`,
          [installationId, accountLogin, accountType]
        );
      }

      if (action === 'deleted') {
        await pool.query(`delete from github_installations where installation_id=$1`, [installationId]);
      }
    }

    return { ok: true, event, action, delivery };
  }

  return { ok: true, event, ignored: true, delivery };
});

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

function requireOrgAdminRole(role) {
  if (role !== 'owner' && role !== 'admin') throw app.httpErrors.forbidden('Insufficient role');
}

// --- GitHub integration (org + repos) ---
app.get('/orgs/:orgId/integrations/github', async (req) => {
  const userId = req.auth.user_id;
  const orgId = req.params.orgId;
  const role = await requireOrgMember(userId, orgId);

  const res = await pool.query(
    `select installation_id, account_login, account_type, created_at, updated_at
     from github_installations
     where org_id=$1
     order by updated_at desc
     limit 1`,
    [orgId]
  );

  return { linked: res.rowCount > 0, role, installation: res.rows[0] ?? null };
});

app.post('/orgs/:orgId/integrations/github/link', async (req) => {
  const userId = req.auth.user_id;
  const orgId = req.params.orgId;
  const role = await requireOrgMember(userId, orgId);
  requireOrgAdminRole(role);

  const body = z
    .object({
      account_login: z.string().min(1)
    })
    .parse(req.body);

  // Find latest installation for that account_login (inserted via webhook)
  const inst = await pool.query(
    `select installation_id
     from github_installations
     where account_login=$1
     order by updated_at desc
     limit 1`,
    [body.account_login]
  );

  if (inst.rowCount === 0) {
    throw app.httpErrors.badRequest(
      `No GitHub installation found for ${body.account_login}. Ensure the app is installed and the webhook delivered.`
    );
  }

  const installationId = inst.rows[0].installation_id;

  await pool.query(
    `update github_installations set org_id=$1, updated_at=now() where installation_id=$2`,
    [orgId, installationId]
  );

  return { ok: true, org_id: orgId, installation_id: installationId, account_login: body.account_login };
});

app.post('/orgs/:orgId/sites/:siteId/repo', async (req) => {
  const userId = req.auth.user_id;
  const { orgId, siteId } = req.params;
  const role = await requireOrgMember(userId, orgId);
  requireOrgAdminRole(role);

  const siteRes = await pool.query(`select id, org_id, slug, name from sites where org_id=$1 and id=$2`, [orgId, siteId]);
  if (siteRes.rowCount === 0) throw app.httpErrors.notFound('Site not found');
  const site = siteRes.rows[0];

  const instRes = await pool.query(
    `select installation_id, account_login
     from github_installations
     where org_id=$1
     order by updated_at desc
     limit 1`,
    [orgId]
  );
  if (instRes.rowCount === 0) throw app.httpErrors.badRequest('GitHub is not linked for this org');

  const { installation_id, account_login } = instRes.rows[0];

  const octokit = getInstallationOctokit(Number(installation_id));
  const repoName = site.slug;

  // Create repo (or attach if already exists)
  let fullName = `${account_login}/${repoName}`;

  try {
    await octokit.repos.get({ owner: account_login, repo: repoName });
  } catch (e) {
    // Not found -> create
    await octokit.repos.createInOrg({
      org: account_login,
      name: repoName,
      private: true,
      description: `Site repo for ${site.name}`
    });
  }

  await pool.query(
    `insert into site_repos (org_id, site_id, provider, repo_full_name, default_branch, installation_id)
     values ($1, $2, 'github', $3, 'main', $4)
     on conflict (site_id) do update set
       repo_full_name=excluded.repo_full_name,
       installation_id=excluded.installation_id`,
    [orgId, siteId, fullName, installation_id]
  );

  return { ok: true, repo_full_name: fullName };
});

// --- Sites CRUD ---
app.get('/orgs/:orgId/sites', async (req) => {
  const userId = req.auth.user_id;
  const orgId = req.params.orgId;
  await requireOrgMember(userId, orgId);

  const res = await pool.query(
    `select s.id, s.org_id, s.type, s.status, s.name, s.slug, s.industry, s.created_at, s.updated_at,
            r.repo_full_name
     from sites s
     left join site_repos r on r.site_id = s.id
     where s.org_id=$1
     order by s.created_at desc`,
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
