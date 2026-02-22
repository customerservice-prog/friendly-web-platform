import { z } from 'zod';
import crypto from 'node:crypto';
import { hashPassword } from './auth.js';

export function registerPasswordResetRoutes(app, pool) {
  // MVP reset flow WITHOUT email sending.
  // 1) Request reset -> returns a reset token in response (temporary for MVP)
  // 2) Confirm reset with token -> sets new password

  app.post('/password-reset/request', async (req) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);

    const userRes = await pool.query(`select id from users where email=$1`, [body.email.toLowerCase()]);
    // Do not leak whether email exists.
    if (userRes.rowCount === 0) {
      return { ok: true };
    }

    const userId = userRes.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await pool.query(
      `insert into password_reset_tokens (user_id, token, expires_at) values ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // MVP: return token directly.
    // Production: email a link containing this token.
    return { ok: true, token, expires_at: expiresAt.toISOString() };
  });

  app.post('/password-reset/confirm', async (req) => {
    const body = z
      .object({
        token: z.string().min(20),
        newPassword: z.string().min(8)
      })
      .parse(req.body);

    const tokRes = await pool.query(
      `select id, user_id, expires_at, used_at
       from password_reset_tokens
       where token=$1`,
      [body.token]
    );

    if (tokRes.rowCount === 0) throw app.httpErrors.badRequest('Invalid reset token');

    const t = tokRes.rows[0];
    if (t.used_at) throw app.httpErrors.badRequest('Reset token already used');
    if (new Date(t.expires_at).getTime() < Date.now()) throw app.httpErrors.badRequest('Reset token expired');

    const password_hash = await hashPassword(body.newPassword);

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`update users set password_hash=$1 where id=$2`, [password_hash, t.user_id]);
      await client.query(`update password_reset_tokens set used_at=now() where id=$1`, [t.id]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }

    return { ok: true };
  });
}
