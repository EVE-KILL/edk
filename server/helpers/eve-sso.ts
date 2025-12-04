import { randomBytes, randomUUID } from 'crypto';
import { env } from './env';
import { storage } from './redis';
import { logger } from './logger';

const TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token';
const VERIFY_URL = 'https://login.eveonline.com/oauth/verify';
const AUTHORIZE_URL = 'https://login.eveonline.com/v2/oauth/authorize';
const STATE_TTL_MS = 5 * 60 * 1000;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token: string;
}

export interface VerifiedCharacter {
  characterId: number;
  characterName: string;
  characterOwnerHash: string;
  scopes: string[];
  tokenType: string;
  expiresOn?: string;
}

interface SsoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}

interface StoredState {
  id: string;
  redirectUrl: string;
  killmailDelay?: number;
  killmailAccess?: boolean;
  createdAt: number;
}

function getConfig(): SsoConfig {
  const isProd = env.NODE_ENV === 'production';
  const clientId = isProd ? env.EVE_CLIENT_ID : env.EVE_CLIENT_ID_DEV;
  const clientSecret = isProd
    ? env.EVE_CLIENT_SECRET
    : env.EVE_CLIENT_SECRET_DEV;
  const redirectUri = isProd
    ? env.EVE_CLIENT_REDIRECT
    : env.EVE_CLIENT_REDIRECT_DEV;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing EVE SSO configuration');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: env.EVE_CLIENT_SCOPES,
  };
}

function stateKey(id: string): string {
  return `sso:state:${id}`;
}

export function encodeState(state: { id: string }): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

export function decodeState(encoded: string): { id?: string } {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return parsed;
  } catch (error) {
    logger.warn('Failed to decode SSO state', { error: String(error) });
    return {};
  }
}

function sanitizeRedirect(input?: string): string {
  if (!input || typeof input !== 'string') return '/';

  try {
    // Prevent open redirects by allowing only relative paths
    if (input.startsWith('/')) {
      return input;
    }
    const parsed = new URL(input, 'http://localhost');
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return '/';
  }
}

export async function createLoginState(options: {
  redirectUrl?: string;
  killmailDelay?: number;
  killmailAccess?: boolean;
}): Promise<{ encoded: string; stored: StoredState }> {
  const id = randomUUID();
  const redirectUrl = sanitizeRedirect(options.redirectUrl);
  const stored: StoredState = {
    id,
    redirectUrl,
    killmailDelay:
      typeof options.killmailDelay === 'number' && options.killmailDelay > 0
        ? options.killmailDelay
        : undefined,
    killmailAccess: options.killmailAccess ?? true,
    createdAt: Date.now(),
  };

  await storage.setItem(stateKey(id), stored);

  return {
    encoded: encodeState({ id }),
    stored,
  };
}

export async function consumeLoginState(
  encodedState?: string
): Promise<StoredState | null> {
  if (!encodedState) return null;

  const decoded = decodeState(encodedState);
  if (!decoded.id) return null;

  const key = stateKey(decoded.id);
  const stored = await storage.getItem<StoredState>(key);

  if (!stored) {
    return null;
  }

  await storage.removeItem(key);

  const isExpired = Date.now() - stored.createdAt > STATE_TTL_MS;
  if (isExpired) {
    return null;
  }

  return stored;
}

export function buildAuthorizeUrl(
  state: string,
  scopesOverride?: string
): string {
  const config = getConfig();
  const scopes =
    scopesOverride && scopesOverride.trim().length > 0
      ? scopesOverride
      : config.scopes;
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    scope: scopes,
    state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function buildAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  )}`;
}

async function postForm<T>(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(
      `SSO request failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

export async function exchangeCodeForToken(
  code: string
): Promise<TokenResponse> {
  const config = getConfig();
  const payload = {
    grant_type: 'authorization_code',
    code,
  };

  return postForm<TokenResponse>(TOKEN_URL, payload, {
    Authorization: buildAuthHeader(config.clientId, config.clientSecret),
    'User-Agent': 'EVE-KILL',
  });
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const config = getConfig();
  const payload = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  return postForm<TokenResponse>(TOKEN_URL, payload, {
    Authorization: buildAuthHeader(config.clientId, config.clientSecret),
    'User-Agent': 'EVE-KILL',
  });
}

export async function verifyAccessToken(
  accessToken: string
): Promise<VerifiedCharacter> {
  const response = await fetch(VERIFY_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to verify access token (${response.status}): ${JSON.stringify(
        data
      )}`
    );
  }

  const scopes =
    typeof data.Scopes === 'string' && data.Scopes.length > 0
      ? data.Scopes.split(' ').filter(Boolean)
      : [];

  return {
    characterId: Number(data.CharacterID),
    characterName: data.CharacterName,
    characterOwnerHash: data.CharacterOwnerHash,
    scopes,
    tokenType: data.TokenType || 'Bearer',
    expiresOn: data.ExpiresOn,
  };
}

export function generateSessionToken(): string {
  return randomBytes(48).toString('hex');
}
