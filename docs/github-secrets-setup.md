# GitHub Secrets Setup for EDK Deployment

To enable automated deployments via GitHub Actions, the following secrets must be configured in your GitHub repository.

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below

## Required Secrets

### Database

- **`POSTGRES_PASSWORD`**
  - Description: PostgreSQL database password
  - Current value: `edk_password` (change for production!)
  - Used by: CloudNativePG cluster, all application pods

### Redis

- **`REDIS_PASSWORD`**
  - Description: Redis cache instance password
  - Current value: Empty string (or set a password)
  - Used by: redis-cache service, cache/redis/ws helpers

- **`REDIS_QUEUE_PASSWORD`**
  - Description: Redis queue instance password (BullMQ)
  - Current value: Empty string (or set a password)
  - Used by: redis-queue service, queue workers

### EVE Online ESI (Production)

- **`EVE_CLIENT_ID`**
  - Description: EVE Online ESI application client ID (production)
  - Current value: `c0e545955b1142d98daeb1e44338501f`
  - Get from: https://developers.eveonline.com/applications

- **`EVE_CLIENT_SECRET`**
  - Description: EVE Online ESI application secret key (production)
  - Current value: `eat_bcgzPYnf09NHDXWHrA5ja63W9HXWlWbL_3569LS`
  - Get from: https://developers.eveonline.com/applications

### EVE Online ESI (Development)

- **`EVE_CLIENT_ID_DEV`**
  - Description: EVE Online ESI application client ID (development)
  - Current value: `012b701a150540c38ad1df007e97e60f`
  - Get from: https://developers.eveonline.com/applications

- **`EVE_CLIENT_SECRET_DEV`**
  - Description: EVE Online ESI application secret key (development)
  - Current value: `eat_1k9YWTIAmW9kIOqzS48UoA5d41xYYhY4W_19xsbz`
  - Get from: https://developers.eveonline.com/applications

### zKillboard

- **`REDISQ_ID`**
  - Description: zKillboard RedisQ identifier
  - Current value: `edkredisqhisquizz`
  - Used by: RedisQ listener pod

## Optional Secrets (AI Features)

If you're using AI features, add these secrets:

- **`OPENAI_API_KEY`**
  - Description: OpenAI or OpenRouter API key
  - Current value: `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`
  - Get from: https://openrouter.ai/

- **`AI_MODEL`**
  - Description: AI model identifier
  - Current value: `x-ai/grok-4.1-fast:free`
  - Options: Any OpenRouter-compatible model

- **`TAVILY_API_KEY`**
  - Description: Tavily API key for web search
  - Current value: `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`
  - Get from: https://tavily.com/

## Verification

After adding all secrets, you can verify they're set correctly:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all the secret names listed
3. Trigger a deployment by pushing to `main` branch
4. Check the workflow logs to ensure deployment succeeds

## Security Notes

- **Never commit secrets to git** - Always use GitHub Secrets or local `values.yaml`
- **Rotate secrets regularly** - Especially for production deployments
- **Use strong passwords** - The default `edk_password` is for development only
- **Separate dev and prod** - Use different ESI applications and secrets for dev vs production

## Troubleshooting

If deployment fails with "couldn't find key X in Secret":

- Verify the secret name matches exactly (case-sensitive)
- Check that the secret has a value (not empty)
- Ensure the secret is in the correct repository

If a secret value needs updating:

- Click on the secret name in GitHub Settings
- Click **Update secret**
- Enter the new value and save
