# Items API

## Get Item/Type Details

### `GET /api/items/{id}`

Returns item type information from the database.

#### Parameters

| Name | Location | Type    | Required | Description |
| ---- | -------- | ------- | -------- | ----------- |
| id   | path     | integer | yes      | The type ID |

#### Response 200 - Success

```json
{
  "typeId": 587,
  "groupId": 419,
  "name": "Rifter",
  "description": "The Rifter is a versatile frigate designed for high-speed combat operations. Fast and agile, the Rifter is a favored choice among capsuleers seeking a nimble and deadly combat vessel.",
  "mass": 1067000,
  "volume": 27289,
  "capacity": 140,
  "portionSize": 1,
  "published": true,
  "marketGroupId": 378,
  "iconId": 3330
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "Item/type not found"
}
```

---

## List Items/Types

### `GET /api/items`

Returns a paginated list of item types, optionally filtered by search term.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| search  | query    | string  | no       | Search term to filter items            |
| page    | query    | integer | no       | Page number (default: 1)               |
| perPage | query    | integer | no       | Items per page (default: 50, max: 200) |

#### Response 200 - Success

```json
{
  "items": [
    {
      "typeId": 587,
      "groupId": 419,
      "name": "Rifter",
      "description": "The Rifter is a versatile frigate designed for high-speed combat operations.",
      "mass": 1067000,
      "volume": 27289,
      "capacity": 140,
      "portionSize": 1,
      "published": true,
      "marketGroupId": 378,
      "iconId": 3330
    },
    {
      "typeId": 638,
      "groupId": 25,
      "name": "Drake",
      "description": "The Drake is a Caldari battlecruiser with a focus on missile-based combat.",
      "mass": 13200000,
      "volume": 125000,
      "capacity": 500,
      "portionSize": 1,
      "published": true,
      "marketGroupId": 351,
      "iconId": 80
    }
  ],
  "page": 1,
  "perPage": 50
}
```

---

## Item Pricing

### `GET /api/items/{id}/pricing`

Returns pricing information for a specific item type.

#### Parameters

| Name | Location | Type    | Required | Description |
| ---- | -------- | ------- | -------- | ----------- |
| id   | path     | integer | yes      | The type ID |

#### Response 200 - Success

```json
{
  "typeId": 587,
  "averagePrice": 125000.5,
  "adjustedPrice": 128000.75,
  "updatedAt": "2025-12-01T10:30:45.000Z"
}
```

#### Response 404 - Not Found

```json
{
  "statusCode": 404,
  "statusMessage": "Pricing data not found"
}
```

---

## Item Killmails

### `GET /api/items/{id}/killmails`

Returns killmails where a specific item type was involved.

#### Parameters

| Name    | Location | Type    | Required | Description                            |
| ------- | -------- | ------- | -------- | -------------------------------------- |
| id      | path     | integer | yes      | The type ID                            |
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

## Count Items/Types

### `GET /api/items/count`

Returns the total count of item types in the database.

#### Response 200 - Success

```json
{
  "count": 34567
}
```
