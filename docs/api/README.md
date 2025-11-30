# API Documentation

Complete API reference for the EVE-KILL EDK platform.

## Base URL

```
https://eve-kill.com/api
```

## API Categories

### Core Entities

- [Killmails](./killmails.md) - Killmail data and retrieval
- [Characters](./characters.md) - Character information and statistics
- [Corporations](./corporations.md) - Corporation information and statistics
- [Alliances](./alliances.md) - Alliance information and statistics
- [Factions](./factions.md) - NPC faction information
- [Wars](./wars.md) - War information and related killmails

### Items & Universe

- [Items](./items.md) - Item types and pricing data
- [System](./system.md) - Solar system information
- [SDE](./sde.md) - Static Data Export endpoints

### Data Export

- [Export](./export.md) - Bulk data export functionality

### Utility

- [Search](./search.md) - Global search functionality
- [Status](./status.md) - API and system status

### Authentication

- [Auth](./auth.md) - OAuth2 authentication endpoints

### AI Tools

- [AI](./ai.md) - AI-powered query and analysis tools

## Response Format

All API responses follow a consistent format:

### Success Response (200)

```json
{
  "data": { ... },
  "page": 1,
  "perPage": 50,
  "total": 1000
}
```

### Error Response (4xx/5xx)

```json
{
  "error": true,
  "statusCode": 400,
  "statusMessage": "Bad Request",
  "message": "Detailed error message",
  "data": [...]
}
```

## Pagination

List endpoints support pagination with the following query parameters:

- `page` (default: 1) - Page number
- `perPage` (default: 50, max: varies by endpoint) - Items per page

## Rate Limiting

The API currently does not enforce rate limiting, but please be respectful of server resources.

## Caching

Many endpoints are cached using Redis:

- Static data (SDE, items): 1 hour
- Entity data (characters, corporations): 5 minutes
- Killmail data: Varies by endpoint

Cache headers are included in responses.

## OpenAPI Specification

Interactive API documentation is available at:

- Swagger UI: `/swagger`
- Scalar UI: `/scalar`
- OpenAPI JSON: `/docs/openapi.json`
