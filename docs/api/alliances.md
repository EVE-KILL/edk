# Alliances API

## Get Alliance Details

### `GET /api/alliances/{id}`

Returns alliance information from the database.

#### Parameters

| Name | Location | Type    | Required | Description     |
| ---- | -------- | ------- | -------- | --------------- |
| id   | path     | integer | yes      | The alliance ID |

#### Response 200 - Success

```json
{
  "allianceId": 933731581,
  "name": "Northern Coalition.",
  "ticker": "NC.",
  "executorCorporationId": 98356193,
  "dateFounded": "2008-05-15T00:00:00.000Z",
  "factionId": null,
  "updatedAt": "2025-12-01T10:30:45.000Z"
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "Alliance not found"
}
```

---

## List Alliances

### `GET /api/alliances`

Returns a paginated list of alliances, optionally filtered by search term.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| search  | query    | string  | no       | Search term to filter alliances        |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "alliances": [
    {
      "allianceId": 933731581,
      "name": "Northern Coalition.",
      "ticker": "NC.",
      "executorCorporationId": 98356193,
      "dateFounded": "2008-05-15T00:00:00.000Z",
      "factionId": null,
      "updatedAt": "2025-12-01T10:30:45.000Z"
    },
    {
      "allianceId": 498125261,
      "name": "Goonswarm Federation",
      "ticker": "CONDI",
      "executorCorporationId": 1344654522,
      "dateFounded": "2010-06-01T00:00:00.000Z",
      "factionId": null,
      "updatedAt": "2025-11-30T14:22:33.000Z"
    }
  ],
  "page": 1,
  "perPage": 50
}
```

---

## Alliance Killmails

### `GET /api/alliances/{id}/killmails`

Returns killmails associated with an alliance.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| id      | path     | integer | yes      | The alliance ID                        |
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

## Count Alliances

### `GET /api/alliances/count`

Returns the total count of alliances in the database.

#### Response 200 - Success

```json
{
  "count": 3456
}
```
