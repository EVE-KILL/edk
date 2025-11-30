# Search API

## Search Entities

### `GET /api/search`

Performs a search for EVE Online entities including characters, corporations, alliances, items, and solar systems.

Uses PostgreSQL full-text search with ts_rank and trigram similarity for relevance ranking.

#### Parameters

| Name  | Location | Type    | Required | Description                                                     |
| ----- | -------- | ------- | -------- | --------------------------------------------------------------- |
| q     | query    | string  | yes      | The search query string (minimum 2 characters)                  |
| limit | query    | integer | no       | Maximum number of results per entity type (default: 5, max: 20) |

#### Response 200 - Success

```json
{
  "results": [
    {
      "id": "95465499",
      "name": "Karbowiak",
      "type": "character",
      "corporationId": 98356193,
      "allianceId": 933731581
    },
    {
      "id": "98356193",
      "name": "Synthetic Systems",
      "type": "corporation",
      "ticker": "SYNTH",
      "allianceId": 933731581,
      "memberCount": 42
    },
    {
      "id": "933731581",
      "name": "Northern Coalition.",
      "type": "alliance",
      "ticker": "NC.",
      "memberCount": 3450
    },
    {
      "id": "587",
      "name": "Rifter",
      "type": "item",
      "groupId": 419,
      "categoryId": 6
    },
    {
      "id": "30000142",
      "name": "Jita",
      "type": "solarsystem",
      "regionId": 10000002,
      "security": 0.946
    }
  ]
}
```

#### Response 200 - No Results

```json
{
  "results": []
}
```

#### Response 500 - Search Error

```json
{
  "statusCode": 500,
  "statusMessage": "Search failed"
}
```

---

## Search Examples

### Search for a character

```
GET /api/search?q=Karbowiak
```

### Search for a corporation

```
GET /api/search?q=Goonswarm
```

### Search for a ship type

```
GET /api/search?q=Drake&limit=10
```

### Search for a solar system

```
GET /api/search?q=Jita
```

---

## Search Notes

- Minimum query length is 2 characters
- Results are ranked by relevance using PostgreSQL full-text search
- Trigram similarity is used for fuzzy matching
- Results include multiple entity types (characters, corporations, alliances, items, solar systems)
- Default limit is 5 results per entity type (max 20)
- Empty or invalid queries return empty results array
