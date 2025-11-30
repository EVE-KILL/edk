# Corporations API

## Get Corporation Details

### `GET /api/corporations/{id}`

Returns corporation information from the database.

#### Parameters

| Name | Location | Type    | Required | Description        |
| ---- | -------- | ------- | -------- | ------------------ |
| id   | path     | integer | yes      | The corporation ID |

#### Response 200 - Success

```json
{
  "corporationId": 98356193,
  "name": "Synthetic Systems",
  "ticker": "SYNTH",
  "memberCount": 42,
  "allianceId": 933731581,
  "ceoId": 95465499,
  "dateFounded": "2015-03-15T00:00:00.000Z",
  "factionId": null,
  "updatedAt": "2025-12-01T10:30:45.000Z"
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "Corporation not found"
}
```

---

## List Corporations

### `GET /api/corporations`

Returns a paginated list of corporations, optionally filtered by search term.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| search  | query    | string  | no       | Search term to filter corporations     |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "corporations": [
    {
      "corporationId": 98356193,
      "name": "Synthetic Systems",
      "ticker": "SYNTH",
      "memberCount": 42,
      "allianceId": 933731581,
      "ceoId": 95465499,
      "dateFounded": "2015-03-15T00:00:00.000Z",
      "factionId": null,
      "updatedAt": "2025-12-01T10:30:45.000Z"
    },
    {
      "corporationId": 98000001,
      "name": "Caldari Provisions",
      "ticker": "CP",
      "memberCount": 15234,
      "allianceId": null,
      "ceoId": 3019494,
      "dateFounded": "2003-05-06T00:00:00.000Z",
      "factionId": 500001,
      "updatedAt": "2025-11-30T08:15:22.000Z"
    }
  ],
  "page": 1,
  "perPage": 50
}
```

---

## Corporation Killmails

### `GET /api/corporations/{id}/killmails`

Returns killmails associated with a corporation.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| id      | path     | integer | yes      | The corporation ID                     |
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

## Count Corporations

### `GET /api/corporations/count`

Returns the total count of corporations in the database.

#### Response 200 - Success

```json
{
  "count": 456789
}
```
