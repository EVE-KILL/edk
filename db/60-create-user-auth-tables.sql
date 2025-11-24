-- ============================================================================
-- USER AUTHENTICATION TABLES
-- ============================================================================
-- Stores EVE SSO user identities, tokens, and session information
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  "id" BIGSERIAL PRIMARY KEY,
  "characterId" BIGINT NOT NULL,
  "characterName" VARCHAR(255) NOT NULL DEFAULT '',
  "characterOwnerHash" VARCHAR(255) NOT NULL DEFAULT '',
  "corporationId" BIGINT,
  "corporationName" VARCHAR(255) DEFAULT '',
  "allianceId" BIGINT,
  "allianceName" VARCHAR(255) DEFAULT '',
  "tokenType" VARCHAR(50) DEFAULT 'Bearer',
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP NOT NULL,
  "scopes" TEXT[] DEFAULT '{}',
  "settings" JSONB DEFAULT '[]'::jsonb,
  "canFetchCorporationKillmails" BOOLEAN DEFAULT false,
  "lastChecked" TIMESTAMP,
  "lastLoginAt" TIMESTAMP DEFAULT NOW(),
  "lastTokenRefreshAt" TIMESTAMP,
  "lastTokenRefreshError" TEXT,
  "admin" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE ("characterId")
);

CREATE INDEX IF NOT EXISTS "idx_users_character_name" ON users ("characterName");
CREATE INDEX IF NOT EXISTS "idx_users_token_expires" ON users ("tokenExpiresAt");

CREATE TABLE IF NOT EXISTS userSessions (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
  "sessionTokenHash" VARCHAR(128) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "lastUsedAt" TIMESTAMP DEFAULT NOW(),
  "ipAddress" VARCHAR(64),
  "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user" ON userSessions ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires" ON userSessions ("expiresAt");
