import { createHash } from 'crypto';
import { database } from '../helpers/database';
import { env } from '../helpers/env';
import {
  TokenResponse,
  VerifiedCharacter,
  generateSessionToken,
  refreshAccessToken,
  verifyAccessToken,
} from '../helpers/eve-sso';
import { logger } from '../helpers/logger';

export interface UserSetting {
  key: string;
  value: any;
  updatedAt?: string;
}

export interface UserRecord {
  id: number;
  characterId: number;
  characterName: string;
  characterOwnerHash: string;
  admin?: boolean;
  corporationId?: number | null;
  corporationName?: string;
  allianceId?: number | null;
  allianceName?: string;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string[];
  settings: UserSetting[];
  canFetchCorporationKillmails: boolean;
  lastChecked?: Date | null;
  lastLoginAt?: Date | null;
  lastTokenRefreshAt?: Date | null;
  lastTokenRefreshError?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface SessionRecord {
  id: number;
  userId: number;
  expiresAt: Date;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  lastUsedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UpsertUserInput {
  characterId: number;
  characterName: string;
  characterOwnerHash: string;
  admin?: boolean;
  corporationId?: number | null;
  corporationName?: string | null;
  allianceId?: number | null;
  allianceName?: string | null;
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scopes: string[];
  killmailDelay?: number;
}

const SESSION_TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toDateOrNull(value: any): Date | null {
  if (!value) return null;
  return new Date(value);
}

function toPgArray(values: string[]): string {
  const escaped = values.map((v) => `"${String(v).replace(/"/g, '\\"')}"`);
  return `{${escaped.join(',')}}`;
}

function mapUser(row: any): UserRecord {
  return {
    id: Number(row.id),
    characterId: Number(row.characterId ?? row.user_characterId),
    characterName: row.characterName ?? row.user_characterName ?? '',
    characterOwnerHash:
      row.characterOwnerHash ?? row.user_characterOwnerHash ?? '',
    admin: Boolean(row.admin ?? row.user_admin ?? false),
    corporationId:
      row.corporationId ?? row.user_corporationId ?? row.corporation_id ?? null,
    corporationName:
      row.corporationName ??
      row.user_corporationName ??
      row.corporation_name ??
      '',
    allianceId:
      row.allianceId ?? row.user_allianceId ?? row.alliance_id ?? null,
    allianceName:
      row.allianceName ?? row.user_allianceName ?? row.alliance_name ?? '',
    tokenType: row.tokenType ?? row.user_tokenType ?? 'Bearer',
    accessToken: row.accessToken ?? row.user_accessToken ?? '',
    refreshToken: row.refreshToken ?? row.user_refreshToken ?? '',
    tokenExpiresAt: new Date(
      row.tokenExpiresAt ?? row.user_tokenExpiresAt ?? Date.now()
    ),
    scopes: Array.isArray(row.scopes ?? row.user_scopes)
      ? (row.scopes ?? row.user_scopes)
      : [],
    settings: Array.isArray(row.settings ?? row.user_settings)
      ? (row.settings ?? row.user_settings)
      : [],
    canFetchCorporationKillmails:
      Boolean(
        row.canFetchCorporationKillmails ??
        row.user_canFetchCorporationKillmails
      ) || false,
    lastChecked: toDateOrNull(row.lastChecked ?? row.user_lastChecked),
    lastLoginAt: toDateOrNull(row.lastLoginAt ?? row.user_lastLoginAt),
    lastTokenRefreshAt: toDateOrNull(
      row.lastTokenRefreshAt ?? row.user_lastTokenRefreshAt
    ),
    lastTokenRefreshError:
      row.lastTokenRefreshError ?? row.user_lastTokenRefreshError ?? null,
    createdAt: toDateOrNull(row.createdAt),
    updatedAt: toDateOrNull(row.updatedAt),
  };
}

function mapSession(row: any): SessionRecord {
  return {
    id: Number(row.id ?? row.session_id),
    userId: Number(row.userId ?? row.session_userId),
    expiresAt: new Date(row.expiresAt ?? row.session_expiresAt),
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
  };
}

function upsertSettings(
  existing: UserSetting[] | undefined,
  killmailDelay?: number
): UserSetting[] {
  if (!killmailDelay || killmailDelay <= 0) {
    return existing ?? [];
  }

  const settings = [...(existing ?? [])];
  const updatedAt = new Date().toISOString();
  const idx = settings.findIndex((setting) => setting.key === 'killmailDelay');
  const newValue: UserSetting = {
    key: 'killmailDelay',
    value: killmailDelay,
    updatedAt,
  };

  if (idx >= 0) {
    settings[idx] = newValue;
  } else {
    settings.push(newValue);
  }

  return settings;
}

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.filter(Boolean)));
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const rows = await database.find<UserRecord>(
    `SELECT * FROM users WHERE "id" = :id LIMIT 1`,
    { id }
  );

  if (!rows.length) return null;
  return mapUser(rows[0]);
}

export async function getUserByCharacterId(
  characterId: number
): Promise<UserRecord | null> {
  const rows = await database.find<UserRecord>(
    `SELECT * FROM users WHERE "characterId" = :characterId LIMIT 1`,
    { characterId }
  );

  if (!rows.length) return null;
  return mapUser(rows[0]);
}

export async function upsertUserLogin(
  input: UpsertUserInput
): Promise<UserRecord> {
  const existing = await getUserByCharacterId(input.characterId);
  const scopesList = normalizeScopes(input.scopes);
  const scopes = scopesList.length > 0 ? scopesList : ['publicData'];
  const settings = upsertSettings(existing?.settings, input.killmailDelay);
  const settingsPayload = JSON.stringify(settings);
  const scopesPayload = toPgArray(scopes);
  const canFetchCorporationKillmails = scopes.includes(
    'esi-killmails.read_corporation_killmails.v1'
  );
  const adminFlag = existing?.admin ?? input.admin ?? false;

  const rows = await database.query<UserRecord>(
    `INSERT INTO users (
      "characterId",
      "characterName",
      "characterOwnerHash",
      "corporationId",
      "corporationName",
      "allianceId",
      "allianceName",
      "tokenType",
      "accessToken",
      "refreshToken",
      "tokenExpiresAt",
      "scopes",
      "settings",
      "canFetchCorporationKillmails",
      "admin",
      "lastChecked",
      "lastLoginAt",
      "lastTokenRefreshAt",
      "lastTokenRefreshError",
      "createdAt",
      "updatedAt"
    ) VALUES (
      :characterId,
      :characterName,
      :characterOwnerHash,
      :corporationId,
      :corporationName,
      :allianceId,
      :allianceName,
      :tokenType,
      :accessToken,
      :refreshToken,
      :tokenExpiresAt,
      :scopes::text[],
      :settings::jsonb,
      :canFetchCorporationKillmails,
      :admin,
      NOW(),
      NOW(),
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT ("characterId") DO UPDATE SET
      "characterName" = EXCLUDED."characterName",
      "characterOwnerHash" = EXCLUDED."characterOwnerHash",
      "corporationId" = EXCLUDED."corporationId",
      "corporationName" = EXCLUDED."corporationName",
      "allianceId" = EXCLUDED."allianceId",
      "allianceName" = EXCLUDED."allianceName",
      "tokenType" = EXCLUDED."tokenType",
      "accessToken" = EXCLUDED."accessToken",
      "refreshToken" = EXCLUDED."refreshToken",
      "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
      "scopes" = EXCLUDED."scopes",
      "settings" = EXCLUDED."settings",
      "canFetchCorporationKillmails" = EXCLUDED."canFetchCorporationKillmails",
      "admin" = users."admin",
      "lastChecked" = NOW(),
      "lastLoginAt" = NOW(),
      "lastTokenRefreshError" = NULL,
      "updatedAt" = NOW()
    RETURNING *`,
    {
      characterId: input.characterId,
      characterName: input.characterName,
      characterOwnerHash: input.characterOwnerHash,
      corporationId: input.corporationId ?? null,
      corporationName: input.corporationName ?? '',
      allianceId: input.allianceId ?? null,
      allianceName: input.allianceName ?? '',
      tokenType: input.tokenType || 'Bearer',
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: scopesPayload,
      settings: settingsPayload,
      canFetchCorporationKillmails,
      admin: adminFlag,
    }
  );

  return mapUser(rows[0]);
}

export async function createSession(
  userId: number,
  meta: { userAgent?: string; ipAddress?: string } = {}
): Promise<{ token: string; session: SessionRecord }> {
  const token = generateSessionToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const rows = await database.query<SessionRecord>(
    `INSERT INTO userSessions (
      "userId",
      "sessionTokenHash",
      "expiresAt",
      "createdAt",
      "updatedAt",
      "lastUsedAt",
      "ipAddress",
      "userAgent"
    ) VALUES (
      :userId,
      :sessionTokenHash,
      :expiresAt,
      NOW(),
      NOW(),
      NOW(),
      :ipAddress,
      :userAgent
    )
    RETURNING *`,
    {
      userId,
      sessionTokenHash: hashedToken,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    }
  );

  return { token, session: mapSession(rows[0]) };
}

export async function touchSession(sessionId: number): Promise<void> {
  const newExpiry = new Date(Date.now() + SESSION_TTL_MS);
  await database.update(
    `UPDATE userSessions
     SET "lastUsedAt" = NOW(),
         "expiresAt" = :expiresAt,
         "updatedAt" = NOW()
     WHERE "id" = :id`,
    { id: sessionId, expiresAt: newExpiry }
  );
}

export async function deleteSessionById(sessionId: number): Promise<void> {
  await database.delete(`DELETE FROM userSessions WHERE "id" = :sessionId`, {
    sessionId,
  });
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await database.delete(
    `DELETE FROM userSessions WHERE "sessionTokenHash" = :tokenHash`,
    { tokenHash }
  );
}

export async function findSessionWithUser(
  token: string
): Promise<{ session: SessionRecord; user: UserRecord } | null> {
  const tokenHash = hashToken(token);

  const rows = await database.find<any>(
    `SELECT
      s."id" as "session_id",
      s."userId" as "session_userId",
      s."expiresAt" as "session_expiresAt",
      s."createdAt" as "session_createdAt",
      s."updatedAt" as "session_updatedAt",
      s."lastUsedAt" as "session_lastUsedAt",
      s."ipAddress" as "session_ipAddress",
      s."userAgent" as "session_userAgent",
      u."id" as "user_id",
      u."characterId" as "user_characterId",
      u."characterName" as "user_characterName",
      u."characterOwnerHash" as "user_characterOwnerHash",
      u."corporationId" as "user_corporationId",
      u."corporationName" as "user_corporationName",
      u."allianceId" as "user_allianceId",
      u."allianceName" as "user_allianceName",
      u."tokenType" as "user_tokenType",
      u."accessToken" as "user_accessToken",
      u."refreshToken" as "user_refreshToken",
      u."tokenExpiresAt" as "user_tokenExpiresAt",
      u."scopes" as "user_scopes",
      u."settings" as "user_settings",
      u."canFetchCorporationKillmails" as "user_canFetchCorporationKillmails",
      u."lastChecked" as "user_lastChecked",
      u."lastLoginAt" as "user_lastLoginAt",
      u."lastTokenRefreshAt" as "user_lastTokenRefreshAt",
      u."lastTokenRefreshError" as "user_lastTokenRefreshError",
      u."createdAt" as "user_createdAt",
      u."updatedAt" as "user_updatedAt"
    FROM userSessions s
    INNER JOIN users u ON u."id" = s."userId"
    WHERE s."sessionTokenHash" = :tokenHash
    LIMIT 1`,
    { tokenHash }
  );

  if (!rows.length) return null;

  const row = rows[0];
  const session = mapSession({
    id: row.session_id,
    userId: row.session_userId,
    expiresAt: row.session_expiresAt,
    createdAt: row.session_createdAt,
    updatedAt: row.session_updatedAt,
    lastUsedAt: row.session_lastUsedAt,
    ipAddress: row.session_ipAddress,
    userAgent: row.session_userAgent,
  });

  if (session.expiresAt < new Date()) {
    await deleteSessionById(session.id);
    return null;
  }

  const user = mapUser({
    id: row.user_id,
    characterId: row.user_characterId,
    characterName: row.user_characterName,
    characterOwnerHash: row.user_characterOwnerHash,
    corporationId: row.user_corporationId,
    corporationName: row.user_corporationName,
    allianceId: row.user_allianceId,
    allianceName: row.user_allianceName,
    tokenType: row.user_tokenType,
    accessToken: row.user_accessToken,
    refreshToken: row.user_refreshToken,
    tokenExpiresAt: row.user_tokenExpiresAt,
    scopes: row.user_scopes,
    settings: row.user_settings,
    canFetchCorporationKillmails: row.user_canFetchCorporationKillmails,
    lastChecked: row.user_lastChecked,
    lastLoginAt: row.user_lastLoginAt,
    lastTokenRefreshAt: row.user_lastTokenRefreshAt,
    lastTokenRefreshError: row.user_lastTokenRefreshError,
    createdAt: row.user_createdAt,
    updatedAt: row.user_updatedAt,
  });

  return { session, user };
}

export function shouldRefreshToken(user: UserRecord): boolean {
  const expiresAt = user.tokenExpiresAt
    ? new Date(user.tokenExpiresAt).getTime()
    : 0;
  const now = Date.now();
  const nextRefreshAllowed =
    (user.lastTokenRefreshAt?.getTime() ?? 0) + TOKEN_REFRESH_COOLDOWN_MS;

  return (
    expiresAt - now <= TOKEN_REFRESH_THRESHOLD_MS && now >= nextRefreshAllowed
  );
}

export async function refreshUserTokens(
  user: UserRecord
): Promise<UserRecord | null> {
  try {
    const tokenResponse: TokenResponse = await refreshAccessToken(
      user.refreshToken
    );
    const verified: VerifiedCharacter = await verifyAccessToken(
      tokenResponse.access_token
    );

    const scopesList = normalizeScopes(
      verified.scopes.length ? verified.scopes : user.scopes
    );
    const scopes = scopesList.length > 0 ? scopesList : ['publicData'];
    const scopesPayload = toPgArray(scopes);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    const canFetchCorporationKillmails = scopes.includes(
      'esi-killmails.read_corporation_killmails.v1'
    );

    const rows = await database.query<UserRecord>(
      `UPDATE users SET
        "accessToken" = :accessToken,
        "refreshToken" = :refreshToken,
        "tokenExpiresAt" = :tokenExpiresAt,
        "tokenType" = :tokenType,
        "scopes" = :scopes::text[],
        "canFetchCorporationKillmails" = :canFetchCorporationKillmails,
        "lastTokenRefreshAt" = NOW(),
        "lastTokenRefreshError" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = :id
      RETURNING *`,
      {
        id: user.id,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? user.refreshToken,
        tokenExpiresAt: expiresAt,
        tokenType: verified.tokenType || tokenResponse.token_type || 'Bearer',
        scopes: scopesPayload,
        canFetchCorporationKillmails,
      }
    );

    return mapUser(rows[0]);
  } catch (error) {
    logger.error('Failed to refresh EVE SSO token', {
      error: String(error),
      characterId: user.characterId,
    });

    await database.update(
      `UPDATE users SET
        "lastTokenRefreshAt" = NOW(),
        "lastTokenRefreshError" = :lastTokenRefreshError,
        "updatedAt" = NOW()
      WHERE "id" = :id`,
      { id: user.id, lastTokenRefreshError: String(error) }
    );

    return null;
  }
}
