# Killmail Value Calculation System

## Overview

Killmail ISK values are now calculated and stored when killmails are processed, eliminating the need for on-the-fly calculation and ensuring consistent, fast statistics.

## Database Schema Changes

Added new value fields to `killmails` table:

```sql
- ship_value TEXT DEFAULT '0'        -- Value of the victim's ship
- fitted_value TEXT DEFAULT '0'       -- Total value of all fitted items (dropped + destroyed)
- dropped_value TEXT DEFAULT '0'      -- Value of dropped items only
- destroyed_value TEXT DEFAULT '0'    -- Value of destroyed items only
- total_value TEXT DEFAULT '0'        -- Ship + fitted items (complete loss value)
```

**Migration**: `db/migrations/0007_familiar_proemial_gods.sql`

## Processing Flow

### 1. Killmail Fetcher (`app/queue/killmail-fetcher.ts`)
- Fetches killmail from ESI
- Triggers value calculation (inline, not queued)
- Enqueues ESI entity fetches (characters, corps, etc.)

### 2. Killmail Service (`app/services/esi/killmail-service.ts`)

#### New Methods:

**`fetchPricesForTypes(typeIds, targetDate)`**
- Fetches prices for all item types
- Finds closest price to killmail date
- Returns Map<typeId, {average}>

**`calculateValues(esiData, priceMap)`**
- Calculates all 5 value fields:
  - **Ship Value**: Victim ship hull price
  - **Fitted Value**: Sum of all item values (dropped + destroyed)
  - **Dropped Value**: Items that dropped as loot
  - **Destroyed Value**: Items that were destroyed
  - **Total Value**: Ship + Fitted (complete killmail value)

**`saveKillmail(esiData, hash, priceMap?)`**
- Now accepts optional price map
- Calculates values if prices provided
- Stores all values in database

**`fetchAndStore(killmailId, hash)`** (updated)
- Fetches killmail from ESI
- Collects all type IDs (ship + items)
- Fetches prices for all types
- Calculates and stores values

## Value Calculation Logic

```typescript
// Ship value
shipValue = price(victim.ship_type_id)

// Item values
for each item:
  dropped_value += quantity_dropped * price(item_type_id)
  destroyed_value += quantity_destroyed * price(item_type_id)

fitted_value = dropped_value + destroyed_value
total_value = ship_value + fitted_value
```

## Statistics Usage

Statistics can now use simple SUM queries:

```typescript
// Total ISK destroyed (all killmails)
SELECT SUM(CAST(total_value AS REAL)) FROM killmails

// Ship losses only
SELECT SUM(CAST(ship_value AS REAL)) FROM killmails

// Fitted losses only
SELECT SUM(CAST(fitted_value AS REAL)) FROM killmails
```

## Benefits

1. **Performance**: No runtime calculation needed
2. **Consistency**: All pages show same values
3. **Simplicity**: Standard SQL SUM() operations
4. **Accuracy**: Values calculated once with proper price matching
5. **Flexibility**: Multiple value breakdowns available

## Removed Components

- ❌ Value Calculator Worker (`app/queue/value-calculator.ts`) - calculation now inline
- ❌ Price fetch queue dispatch from killmail-fetcher
- ❌ Async value calculation after save

## Price Fetching

Prices are still fetched by the `PriceFetcher` cronjob (daily at 4 AM UTC) and stored in the `prices` table. The killmail service queries this table when processing killmails.

## Migration Instructions

1. Run migration: `bun cli db:migrate`
2. Existing killmails will have `0` values
3. To recalculate existing killmails, you would need to:
   - Re-fetch from ESI, or
   - Create a migration script to calculate retroactively

## Future Enhancements

- Add zkillboard point values
- Track fitted vs cargo separately
- Add "loot dropped %" calculation
- Store attacker ship values for fleet composition stats
