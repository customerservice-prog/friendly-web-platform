import crypto from 'node:crypto';
import { getGitHubConfig } from './github-app.js';

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function verifyGitHubWebhook(req) {
  const { webhookSecret } = getGitHubConfig();

  const sig = req.headers['x-hub-signature-256'];
  if (!sig || typeof sig !== 'string') return false;

  const raw = req.rawBody;
  if (!raw) return false;

  const hmac = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
  const expected = `sha256=${hmac}`;
  return timingSafeEqual(expected, sig);
}
