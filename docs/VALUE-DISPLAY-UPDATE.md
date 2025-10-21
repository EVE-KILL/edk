# Value Display Update

## Overview

Updated all pages to use the pre-calculated ISK value fields from the database instead of calculating values on-demand.

## Changes Made

### 1. Killmail Generator (`app/generators/killmail.ts`)

**Changed**: Now reads pre-calculated values from database fields instead of computing them:

```typescript
// OLD: Calculate values on-demand
const shipPrice = priceMap.get(km.victimShipTypeId || 0);
const shipValue = shipPrice ? shipPrice.average : 0;
const destroyedValue = calculateItemValue(destroyedItems);
const droppedValue = calculateItemValue(droppedItems);
const totalValue = shipValue + itemsValue;

// NEW: Use pre-calculated values from database
const shipValue = parseFloat(km.killmailShipValue || "0");
const itemsValue = parseFloat(km.killmailFittedValue || "0");
const destroyedValue = parseFloat(km.killmailDestroyedValue || "0");
const droppedValue = parseFloat(km.killmailDroppedValue || "0");
const totalValue = parseFloat(km.killmailTotalValue || "0");
```

**Added fields** to SELECT query:
- `killmailShipValue`
- `killmailFittedValue`
- `killmailDroppedValue`
- `killmailDestroyedValue`
- `killmailTotalValue`
- `killmailAttackerCount`
- `killmailIsSolo`

**Benefits**:
- ✅ Consistent values across all pages
- ✅ No more complex price lookups on every page load
- ✅ Better performance (single DB query vs calculating from items)
- ✅ Values calculated once at ingestion with proper price matching

### 2. Character Generator (`app/generators/character.ts`)

**Added ISK statistics** to character profiles:

```typescript
stats: {
  kills: number;
  losses: number;
  killLossRatio: number;
  efficiency: number;
  iskDestroyed: string;     // NEW
  iskLost: string;          // NEW
  iskEfficiency: number;    // NEW
}
```

**Implementation**:
- Sums `totalValue` from killmails where character is attacker (ISK destroyed)
- Sums `totalValue` from killmails where character is victim (ISK lost)
- Calculates ISK efficiency: `iskDestroyed / (iskDestroyed + iskLost) * 100`

### 3. Corporation Generator (`app/generators/corporation.ts`)

**Added ISK statistics** to corporation profiles:

Same structure as character stats:
- `iskDestroyed` - ISK destroyed by corporation members
- `iskLost` - ISK lost by corporation members
- `iskEfficiency` - Corporation's ISK efficiency percentage

### 4. Alliance Generator (`app/generators/alliance.ts`)

**Added ISK statistics** to alliance profiles:

Same structure as character/corp stats:
- `iskDestroyed` - ISK destroyed by alliance members
- `iskLost` - ISK lost by alliance members
- `iskEfficiency` - Alliance's ISK efficiency percentage

### 5. Entity Stats Template (`templates/partials/entity-stats.hbs`)

**Added ISK display rows**:

```handlebars
<tr class="kb-table-row-even">
    <td class="kb-table-cell"><b>ISK Destroyed:</b></td>
    <td class="kb-table-cell"><span class="isk-value">{{formatISK stats.iskDestroyed}}</span></td>
</tr>
<tr class="kb-table-row-odd">
    <td class="kb-table-cell"><b>ISK Lost:</b></td>
    <td class="kb-table-cell"><span class="isk-value">{{formatISK stats.iskLost}}</span></td>
</tr>
<tr class="kb-table-row-even">
    <td class="kb-table-cell"><b>ISK Efficiency:</b></td>
    <td class="kb-table-cell"><span class="isk-value">{{formatNumber stats.iskEfficiency}}%</span></td>
</tr>
```

This template is used by:
- Character detail pages
- Corporation detail pages
- Alliance detail pages

## Statistics Already Updated

The statistics generator (`app/generators/statistics.ts`) was already updated in the previous refactor to use the simple query:

```typescript
sql`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`
```

This is used on:
- Homepage statistics
- Filtered statistics (FOLLOWED_* entities)

## Testing

To verify the changes are working:

1. **Test killmail detail page**: `/killmail/130678568`
   - Should show pre-calculated values
   - Ship Value: 489,400 ISK
   - Total Value: 6,324,864 ISK

2. **Test character page**: `/character/:id`
   - Should show ISK Destroyed, ISK Lost, ISK Efficiency
   - Statistics should load quickly (no on-demand calculation)

3. **Test corporation page**: `/corporation/:id`
   - Same ISK stats as character

4. **Test alliance page**: `/alliance/:id`
   - Same ISK stats as character

5. **Test homepage**: `/`
   - Statistics should show Total ISK Destroyed
   - Should use pre-calculated values from database

## Performance Impact

**Before**: Each killmail page required:
- Fetching all items
- Looking up prices for each item type
- Calculating ship value
- Calculating destroyed/dropped values
- Aggregating totals

**After**: Each killmail page requires:
- Single SELECT query with pre-calculated values
- No price lookups needed
- No calculations needed

**Estimated improvement**: 50-80% faster page loads for killmail details, statistics pages

## Data Consistency

All ISK values now come from a single source (the database fields calculated during killmail ingestion), ensuring:
- Same value shown on killmail detail page
- Same value used in statistics
- Same value shown in killlists
- Same value used for character/corp/alliance stats

No more discrepancies due to different calculation methods or timing of price data.
