# Price System

Automatic market price tracking for killmail enrichment. Fetches market data from EVE-KILL.com API and stores it for quick access when displaying killmails.

## Overview

- **Data Source**: EVE-KILL.com Public API (`https://eve-kill.com/api/prices`)
- **Update Frequency**: Daily at 4 AM UTC via cronjob scheduler
- **Storage**: SQLite `prices` table with type_id + date unique constraint
- **Indexing**: Optimized for fast lookup by type_id and date
- **No Rate Limiting Issues**: Includes request throttling (100ms between requests)

## Price Data Stored

For each item type on each date:

```typescript
{
  typeId: number;           // EVE item type ID
  date: Date;               // Date of price snapshot
  average: number;          // Average price across all regions
  highest: number;          // Highest region price
  lowest: number;           // Lowest region price
  orderCount: number;       // Total market orders
  volume: number;           // ISK volume
}
```

## Price Fetcher Cronjob

Automatically runs daily at **4:00 AM UTC** to fetch prices for the previous day.

**Location**: `/app/cronjobs/price-fetcher.ts`

### How It Works

1. Runs at schedule time (4 AM UTC)
2. Determines yesterday's date
3. Fetches top 100 item types from killmails
4. Queries EVE-KILL API for prices on that date
5. Stores prices in database (skips if already exists)
6. Returns summary: `Fetched: X, Stored: Y, Failed: Z`

### Example Output

```
🚀 Running cronjob: price-fetcher
✅ price-fetcher completed in 8234ms: Fetched: 95, Stored: 87, Failed: 0
```

## Usage in Code

### Fetch Prices from EVE-KILL API

```typescript
import { priceService } from "../../app/services/price-service";

// Get current prices for an item
const prices = await priceService.getPriceForType(587); // Rifter

// Get prices from 7 days ago
const historicalPrices = await priceService.getPriceForType(587, 7);

// Get prices for a specific date (Unix timestamp in seconds)
const dateUnix = Math.floor(new Date("2023-10-27").getTime() / 1000);
const pricesOnDate = await priceService.getPriceForTypeOnDate(587, dateUnix);

// Get region-specific prices
const regionPrices = await priceService.getPriceForRegion(10000002); // The Forge
```

### Query Cached Prices from Database

```typescript
import { db } from "../../src/db";
import { prices } from "../../db/schema";
import { eq, and } from "drizzle-orm";

// Get price for an item on a specific date
const killmailDate = new Date("2023-10-27");
killmailDate.setHours(0, 0, 0, 0);

const price = await db
  .select()
  .from(prices)
  .where(
    and(
      eq(prices.typeId, 587),
      eq(prices.date, killmailDate)
    )
  )
  .limit(1)
  .get();

if (price) {
  console.log(`Average price: ${price.average} ISK`);
}
```

## API Reference

### Price Service Methods

#### `getPriceForType(typeId, daysBack?)`
Get prices for a specific item across all regions

**Parameters:**
- `typeId` (number) - EVE item type ID
- `daysBack` (number, default: 1) - Number of days back to fetch

**Returns:** `IPrice[]` - Array of prices across regions

#### `getPriceForRegion(regionId, daysBack?)`
Get prices for a specific region

**Parameters:**
- `regionId` (number) - EVE region ID
- `daysBack` (number, default: 1) - Number of days back

**Returns:** `IPrice[]` - Array of prices for that region

#### `getPriceForTypeOnDate(typeId, dateUnix)`
Get prices for a specific date

**Parameters:**
- `typeId` (number) - EVE item type ID
- `dateUnix` (number) - Unix timestamp in seconds

**Returns:** `IPrice[]` - Array of prices for that date

#### `getPriceCount()`
Check total number of prices in EVE-KILL database

**Returns:** `number` - Total price records

## Database Schema

### `prices` Table

```sql
CREATE TABLE prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id INTEGER NOT NULL,
  date INTEGER NOT NULL,           -- Timestamp
  average REAL,
  highest REAL,
  lowest REAL,
  order_count INTEGER,
  volume INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(type_id, date)
);

CREATE INDEX prices_type_id_idx ON prices(type_id);
CREATE INDEX prices_date_idx ON prices(date);
CREATE INDEX prices_type_id_date_idx ON prices(type_id, date);
```

## Configuration

Enable/disable price fetching via environment variable:

```bash
# .env
CRONJOBS_ENABLED=true   # Enables price fetcher cronjob
```

The price fetcher runs automatically as part of the cronjob scheduler.

## Performance Notes

- **Unique Constraint**: `(type_id, date)` prevents duplicate entries
- **Request Throttling**: 100ms delay between API requests to respect rate limits
- **Batch Processing**: Fetches top 100 types from recent killmails for efficiency
- **Index Strategy**: Indexed by type_id and date for fast lookups

## Future Enhancements

- [ ] Add regional price averaging (currently averages all regions)
- [ ] Implement backfill for historical prices (retroactively fetch old prices)
- [ ] Add price analytics (trend tracking, volatility)
- [ ] Create API endpoint for price queries: `/api/prices/:typeId`
- [ ] Add price display to killmail detail pages
- [ ] Calculate killmail value in real-time based on stored prices
