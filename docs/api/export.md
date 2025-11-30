# Export API

## Get Export Options

### `GET /api/export`

Returns available export collections and formats.

#### Response 200 - Success

```json
{
  "collections": [
    "killmails",
    "characters",
    "corporations",
    "alliances",
    "types",
    "prices"
  ],
  "formats": ["json", "csv"],
  "note": "Use /api/export/{collection} to export a specific collection"
}
```

---

## Export Collection

### `GET /api/export/{collection}`

Exports data from a specific collection (limited to 10,000 records for performance).

#### Parameters

| Name       | Location | Type    | Required | Description                                                                              |
| ---------- | -------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| collection | path     | string  | yes      | The collection to export (killmails, characters, corporations, alliances, types, prices) |
| format     | query    | string  | no       | Export format: json or csv (default: json)                                               |
| limit      | query    | integer | no       | Maximum number of records (default: 1000, max: 10000)                                    |

#### Response 200 - Success (JSON)

```json
{
  "collection": "characters",
  "count": 1000,
  "data": [
    {
      "characterId": 95465499,
      "name": "Karbowiak",
      "corporationId": 98356193,
      "allianceId": 933731581,
      "factionId": null,
      "securityStatus": -2.345,
      "updatedAt": "2025-12-01T10:30:45.000Z"
    },
    {
      "characterId": 1234567890,
      "name": "Test Pilot",
      "corporationId": 98000001,
      "allianceId": null,
      "factionId": null,
      "securityStatus": 5.0,
      "updatedAt": "2025-11-30T15:20:10.000Z"
    }
  ]
}
```

#### Response 200 - Success (CSV)

```
characterId,name,corporationId,allianceId,factionId,securityStatus,updatedAt
95465499,"Karbowiak",98356193,933731581,,-2.345,"2025-12-01T10:30:45.000Z"
1234567890,"Test Pilot",98000001,,,5.0,"2025-11-30T15:20:10.000Z"
```

#### Response 400 - Invalid Collection

```json
{
  "statusCode": 400,
  "statusMessage": "Invalid collection. Must be one of: killmails, characters, corporations, alliances, types, prices"
}
```

---

## Export Killmails

### `GET /api/export/killmails`

Exports killmails data (limited to 10,000 records for performance).

#### Parameters

| Name   | Location | Type    | Required | Description                                           |
| ------ | -------- | ------- | -------- | ----------------------------------------------------- |
| format | query    | string  | no       | Export format: json or csv (default: json)            |
| limit  | query    | integer | no       | Maximum number of records (default: 1000, max: 10000) |

#### Response 200 - Success

```json
{
  "collection": "killmails",
  "count": 1000,
  "data": [
    {
      "killmailId": 113333333,
      "killmailTime": "2025-12-01T12:34:56.000Z",
      "solarSystemId": 30000142,
      "victimCharacterId": 95465499,
      "victimCorporationId": 98356193,
      "victimAllianceId": 933731581,
      "victimShipTypeId": 587,
      "totalValue": 125000000.5
    }
  ]
}
```

---

## Export Killmails with Filters (POST)

### `POST /api/export/killmails`

Exports killmails based on provided filters (limited to 10,000 records).

#### Request Body

```json
{
  "filters": {
    "characterId": 95465499,
    "corporationId": 98356193,
    "allianceId": 933731581,
    "solarSystemId": 30000142,
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-12-01T23:59:59.000Z"
  },
  "format": "json",
  "limit": 5000
}
```

#### Response 200 - Success

```json
{
  "collection": "killmails",
  "count": 142,
  "data": [
    {
      "killmailId": 113333333,
      "killmailTime": "2025-12-01T12:34:56.000Z",
      "solarSystemId": 30000142,
      "victimCharacterId": 95465499,
      "victimCorporationId": 98356193,
      "victimAllianceId": 933731581,
      "victimShipTypeId": 587,
      "totalValue": 125000000.5
    }
  ]
}
```

#### Response 400 - Invalid Filters

```json
{
  "statusCode": 400,
  "statusMessage": "Invalid filter parameters"
}
```
