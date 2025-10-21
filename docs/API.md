# API Documentation - EVE Kill v4

## Overview

All API endpoints return JSON responses. Endpoints support pagination and caching for optimal performance.

## Response Format

### Success Response
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "page": 1,
    "count": 20,
    "hasMore": true,
    "nextPage": 2
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "status": 400
}
```

## Killmail Endpoints

### GET /api/killlist

Returns a paginated list of all killmails.

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)
- `before` (optional): ISO timestamp to fetch killmails before (backward compatibility)
- `characterId` (optional): Filter by character ID (comma-separated for multiple)
- `corporationId` (optional): Filter by corporation ID (comma-separated)
- `allianceId` (optional): Filter by alliance ID (comma-separated)
- `killsOnly` (optional): Only show kills (true/false)
- `lossesOnly` (optional): Only show losses (true/false)

**Caching:** 60 seconds

**Example:**
```bash
GET /api/killlist?limit=50&page=1
GET /api/killlist?characterId=123456&killsOnly=true
GET /api/killlist?corporationId=98000001,98000002&page=2
```

### GET /api/killmails/:id

Returns detailed information about a specific killmail.

**Parameters:**
- `id` (required): Killmail ID

**Example:**
```bash
GET /api/killmails/123456789
```

---

## Character Endpoints

### GET /api/characters/:id

Returns basic character information from ESI.

**Parameters:**
- `id` (required): Character ID

**Caching:** 300 seconds (5 minutes)

**Example:**
```bash
GET /api/characters/123456
```

### GET /api/characters/:id/kills

Returns character kills with pagination and stats.

**Parameters:**
- `id` (required): Character ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Response:**
```json
{
  "character": {
    "id": 123456,
    "name": "Character Name"
  },
  "stats": {
    "kills": 150,
    "losses": 25,
    "killLossRatio": 6.0,
    "efficiency": 85.7
  },
  "data": [...killmails...],
  "pagination": {
    "limit": 20,
    "page": 1,
    "count": 20,
    "hasMore": true,
    "nextPage": 2
  }
}
```

**Example:**
```bash
GET /api/characters/123456/kills?limit=50&page=1
```

### GET /api/characters/:id/losses

Returns character losses with pagination and stats.

**Parameters:**
- `id` (required): Character ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Example:**
```bash
GET /api/characters/123456/losses?limit=20&page=2
```

---

## Corporation Endpoints

### GET /api/corporations/:id

Returns basic corporation information from ESI.

**Parameters:**
- `id` (required): Corporation ID

**Caching:** 300 seconds (5 minutes)

**Example:**
```bash
GET /api/corporations/98000001
```

### GET /api/corporations/:id/kills

Returns corporation kills with pagination and stats.

**Parameters:**
- `id` (required): Corporation ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Response:** Same structure as character kills endpoint

**Example:**
```bash
GET /api/corporations/98000001/kills?limit=50
```

### GET /api/corporations/:id/losses

Returns corporation losses with pagination and stats.

**Parameters:**
- `id` (required): Corporation ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Example:**
```bash
GET /api/corporations/98000001/losses
```

---

## Alliance Endpoints

### GET /api/alliances/:id

Returns basic alliance information from ESI.

**Parameters:**
- `id` (required): Alliance ID

**Caching:** 300 seconds (5 minutes)

**Example:**
```bash
GET /api/alliances/99000001
```

### GET /api/alliances/:id/kills

Returns alliance kills with pagination and stats.

**Parameters:**
- `id` (required): Alliance ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Example:**
```bash
GET /api/alliances/99000001/kills?page=1
```

### GET /api/alliances/:id/losses

Returns alliance losses with pagination and stats.

**Parameters:**
- `id` (required): Alliance ID

**Query Parameters:**
- `limit` (optional): Number of killmails to return (default: 20, max: 100)
- `page` (optional): Page number (default: 1)

**Caching:** 60 seconds

**Example:**
```bash
GET /api/alliances/99000001/losses?limit=100
```

---

## Search Endpoint

### GET /api/search

Search for characters, corporations, and alliances.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results to return (default: 10)

**Example:**
```bash
GET /api/search?q=test&limit=20
```

---

## System Information Endpoints

### GET /api/health

Returns health check information.

### GET /api/queue/stats

Returns queue statistics.

### GET /api/cache/stats

Returns cache statistics.

### GET /api/types/:id

Returns type information for a specific item/ship.

**Parameters:**
- `id` (required): Type ID

**Example:**
```bash
GET /api/types/587
```

### GET /api/systems/:id

Returns solar system information.

**Parameters:**
- `id` (required): Solar System ID

**Example:**
```bash
GET /api/systems/30000142
```

---

## Rate Limiting

All API endpoints respect ESI rate limits and implement response caching to minimize load.

## CORS

CORS is enabled for all API endpoints.

## Pagination

All paginated endpoints support:
- **Offset-based pagination**: Use `page` and `limit` parameters
- **Backward compatibility**: Some endpoints support `before` timestamp for cursor-based pagination

## Caching

- Entity detail endpoints: 300 seconds (5 minutes)
- Killmail list endpoints: 60 seconds (1 minute)
- Caching varies by query parameters automatically
