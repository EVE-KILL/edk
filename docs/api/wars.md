# Wars API

## Get War Details

### `GET /api/wars/{id}`

Returns war information from the database.

#### Parameters

| Name | Location | Type    | Required | Description |
| ---- | -------- | ------- | -------- | ----------- |
| id   | path     | integer | yes      | The war ID  |

#### Response 200 - Success

```json
{
  "warId": 615476,
  "aggressorId": 98356193,
  "aggressorType": "corporation",
  "defenderId": 98000001,
  "defenderType": "corporation",
  "declared": "2025-11-15T12:00:00.000Z",
  "started": "2025-11-16T12:00:00.000Z",
  "finished": null,
  "mutual": false,
  "openForAllies": true,
  "retracted": null,
  "updatedAt": "2025-12-01T10:30:45.000Z"
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "War not found"
}
```

---

## List Wars

### `GET /api/wars`

Returns a paginated list of wars.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "wars": [
    {
      "warId": 615476,
      "aggressorId": 98356193,
      "aggressorType": "corporation",
      "defenderId": 98000001,
      "defenderType": "corporation",
      "declared": "2025-11-15T12:00:00.000Z",
      "started": "2025-11-16T12:00:00.000Z",
      "finished": null,
      "mutual": false,
      "openForAllies": true,
      "retracted": null,
      "updatedAt": "2025-12-01T10:30:45.000Z"
    },
    {
      "warId": 615475,
      "aggressorId": 933731581,
      "aggressorType": "alliance",
      "defenderId": 498125261,
      "defenderType": "alliance",
      "declared": "2025-11-10T08:30:00.000Z",
      "started": "2025-11-11T08:30:00.000Z",
      "finished": "2025-11-25T10:15:22.000Z",
      "mutual": true,
      "openForAllies": false,
      "retracted": null,
      "updatedAt": "2025-11-25T10:15:22.000Z"
    }
  ],
  "page": 1,
  "perPage": 50
}
```

---

## War Statistics

### `GET /api/wars/{id}/stats`

Returns statistics for a specific war.

#### Parameters

| Name | Location | Type    | Required | Description |
| ---- | -------- | ------- | -------- | ----------- |
| id   | path     | integer | yes      | The war ID  |

#### Response 200 - Success

```json
{
  "warId": 615476,
  "totalKills": 142,
  "aggressorKills": 89,
  "defenderKills": 53,
  "totalValue": 45600000000.75,
  "aggressorValue": 28400000000.25,
  "defenderValue": 17200000000.5
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "War not found"
}
```
