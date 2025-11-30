# Killmails API

Endpoints for retrieving killmail data.

## Get Killmail by ID

```
GET /api/killmail/{id}
```

Retrieves a specific killmail in ESI format.

### Parameters

- `id` (path, required) - Killmail ID

### Response 200

```json
{
  "killmail_id": 123456789,
  "killmail_time": "2024-12-01T12:00:00Z",
  "solar_system_id": 30000142,
  "victim": {
    "character_id": 123456,
    "corporation_id": 98765,
    "alliance_id": 99000001,
    "ship_type_id": 670,
    "damage_taken": 15420,
    "position": {
      "x": 123456789.0,
      "y": -987654321.0,
      "z": 456789123.0
    }
  },
  "attackers": [
    {
      "character_id": 789456,
      "corporation_id": 87654,
      "ship_type_id": 11176,
      "weapon_type_id": 2977,
      "damage_done": 8542,
      "final_blow": true,
      "security_status": -5.2
    }
  ],
  "zkb": {
    "locationID": 40000001,
    "hash": "abc123def456",
    "fittedValue": 123456789.5,
    "droppedValue": 45678.9,
    "destroyedValue": 123411110.6,
    "totalValue": 123456789.5,
    "points": 42,
    "npc": false,
    "solo": false,
    "awox": false
  }
}
```

### Response 404

```json
{
  "error": true,
  "statusCode": 404,
  "statusMessage": "Killmail not found",
  "message": "Killmail 123456789 not found"
}
```

## Search Killmails

```
POST /api/killmail/search
```

Search for killmails with advanced filters.

### Request Body

```json
{
  "page": 1,
  "perPage": 50,
  "filters": {
    "victimCharacterIds": [123456],
    "victimCorporationIds": [98765],
    "victimAllianceIds": [99000001],
    "attackerCharacterIds": [789456],
    "attackerCorporationIds": [87654],
    "attackerAllianceIds": [99000002],
    "shipTypeIds": [670, 11176],
    "solarSystemIds": [30000142],
    "regionIds": [10000002],
    "minValue": 1000000000,
    "maxValue": 10000000000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "solo": false,
    "npc": false
  }
}
```

### Response 200

```json
{
  "killmails": [
    {
      "killmailId": 123456789,
      "killmailTime": "2024-12-01T12:00:00.000Z",
      "solarSystemId": 30000142,
      "solarSystemName": "Jita",
      "regionId": 10000002,
      "regionName": "The Forge",
      "victimCharacterId": 123456,
      "victimCharacterName": "Victim Name",
      "victimCorporationId": 98765,
      "victimCorporationName": "Victim Corp",
      "victimShipTypeId": 670,
      "victimShipTypeName": "Capsule",
      "attackerCount": 15,
      "totalValue": 123456789.5,
      "points": 42
    }
  ],
  "page": 1,
  "perPage": 50,
  "total": 1543
}
```

## Get Recent Killmails

```
GET /api/killmail/recent
```

Get the most recent killmails.

### Query Parameters

- `limit` (optional, default: 50, max: 200) - Number of killmails to return

### Response 200

```json
{
  "killmails": [
    {
      "killmailId": 123456789,
      "killmailTime": "2024-12-01T12:00:00.000Z",
      "solarSystemName": "Jita",
      "victimCharacterName": "Victim Name",
      "victimShipTypeName": "Capsule",
      "totalValue": 123456789.5
    }
  ],
  "count": 50
}
```
