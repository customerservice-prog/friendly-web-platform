import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Server misconfigured: ${name} is required`);
  return v;
}

export function getGitHubConfig() {
  const appId = Number(requireEnv('GITHUB_APP_ID'));
  const clientId = requireEnv('GITHUB_CLIENT_ID');
  const clientSecret = requireEnv('GITHUB_CLIENT_SECRET');
  const webhookSecret = requireEnv('GITHUB_WEBHOOK_SECRET');

  // Render env vars support multiline; paste the whole PEM.
  const privateKey = requireEnv('GITHUB_PRIVATE_KEY_PEM').replace(/\\n/g, '\n');

  const publicBaseUrl = requireEnv('PUBLIC_BASE_URL'); // e.g. https://friendly-api-pz4k.onrender.com

  return { appId, clientId, clientSecret, webhookSecret, privateKey, publicBaseUrl };
}

export function getAppOctokit() {
  const { appId, privateKey } = getGitHubConfig();
  return new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey } });
}

export function getInstallationOctokit(installationId) {
  const { appId, privateKey } = getGitHubConfig();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId
    }
  });
}

export function getGitHubAppInstallUrl() {
  const { clientId } = getGitHubConfig();
  // Direct install URL for the app. This triggers installation flow.
  // For org-owned app installs, client_id works.
  return `https://github.com/apps/${encodeURIComponent(process.env.GITHUB_APP_SLUG || 'friendly-web-platform')}/installations/new`;
}

export function getGitHubOAuthAuthorizeUrl(state) {
  const { clientId, publicBaseUrl } = getGitHubConfig();
  const redirectUri = `${publicBaseUrl}/integrations/github/callback`;
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  // scope is not required for GitHub Apps user-to-server token exchange; keep empty.
  return u.toString();
}

export async function exchangeOAuthCode(code) {
  const { clientId, clientSecret, publicBaseUrl } = getGitHubConfig();
  const redirectUri = `${publicBaseUrl}/integrations/github/callback`;

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error_description || json.error || 'OAuth exchange failed');
  }
  return json; // { access_token, token_type, scope }
}
