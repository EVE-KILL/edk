# Characters API

## Get Character Details

### `GET /api/characters/{id}`

Returns character information from the database.

#### Parameters

| Name | Location | Type    | Required | Description      |
| ---- | -------- | ------- | -------- | ---------------- |
| id   | path     | integer | yes      | The character ID |

#### Response 200 - Success

```json
{
  "characterId": 95465499,
  "name": "Karbowiak",
  "corporationId": 98356193,
  "allianceId": 933731581,
  "factionId": null,
  "securityStatus": -2.345,
  "updatedAt": "2025-12-01T10:30:45.000Z"
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "Character not found"
}
```

---

## List Characters

### `GET /api/characters`

Returns a paginated list of characters, optionally filtered by search term.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| search  | query    | string  | no       | Search term to filter characters       |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "characters": [
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
  ],
  "page": 1,
  "perPage": 50
}
```

---

## Character Killmails

### `GET /api/characters/{id}/killmails`

Returns killmails associated with a character.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| id      | path     | integer | yes      | The character ID                       |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "killmails": [
    {
      "killmailId": 113333333,
      "killmailTime": "2025-12-01T12:34:56.000Z",
      "solarSystemId": 30000142,
      "totalValue": 125000000.5
    }
  ],
  "page": 1,
  "perPage": 50
}
```

---

## Count Characters

### `GET /api/characters/count`

Returns the total count of characters in the database.

#### Response 200 - Success

```json
{
  "count": 1234567
}
```
