# Stats Recalculation Command

## Overview

This document describes the `db:recalc-stats` command, which was implemented to solve the issue of stale entity statistics (kills, losses, ISK destroyed/lost) following bulk killmail imports.

## Problem Context

When bulk importing killmails (e.g., via `backfills:everef-kb`), the data is inserted directly into the `killmails` and `attackers` tables for maximum performance. This bypasses the standard queue-based processing (`queue/entity-stats.ts`) that normally updates the `entity_stats_cache` table in real-time.

As a result, while the raw killmail data is present, the statistics cache used for leaderboards and entity profiles remains empty or outdated.

## Solution: `db:recalc-stats`

We created a dedicated command to rebuild the `entity_stats_cache` table from scratch using the raw data in the database.

### Command Location
`commands/db/recalc-stats.ts`

### Usage

**Full Rebuild (Recommended):**
```bash
bun cli db:recalc-stats --truncate
```
This truncates the cache table and processes all killmails from 2007 to present.

**Partial Rebuild (Specific Years):**
```bash
bun cli db:recalc-stats --start-year 2024 --end-year 2024
```
Useful if you only backfilled a specific range, but note that without `--truncate`, stats will be *added* to existing values. If you re-import the same data, you might double-count unless you truncate first.

### How It Works

1.  **Truncate (Optional):** Clears the `entity_stats_cache` table.
2.  **Month-by-Month Processing:** Iterates through every month from 2007 to the current date.
3.  **SQL Aggregation:** For each month, it executes a massive SQL query that:
    *   Aggregates **Losses** (Victim) for Characters, Corporations, Alliances, Factions, and Ship Types.
    *   Aggregates **Kills** (Attackers) for the same entity types.
    *   Calculates counts (solo, npc) and sums ISK values.
    *   Uses `UNION ALL` to combine all these stats into a single temporary dataset.
4.  **Bulk Upsert:** Inserts these aggregated results into `entity_stats_cache`.
    *   Uses `ON CONFLICT ("entityId", "entityType") DO UPDATE` to increment existing values.
    *   This builds up the "All-Time" columns (`killsAll`, `lossesAll`, etc.).
5.  **Time Buckets (90d/30d/14d):** After processing all history, it runs a targeted query on just the last 90 days of data to recalculate and overwrite the `90d`, `30d`, and `14d` columns.

## Original Request & Discussion

**User Prompt:**
> "ok it seems that in our haste to remove the automatic update of the kills, losses, etc as a trigger on the killmail database, we also nuked any kind of recalculation when the killmails are being inserted.
> So we need a job that recalculates all stats for all characters, corporations and alliances that can be run once to update all the stats."

**Key Points Discussed:**
*   The original trigger-based system was removed to prevent deadlocks.
*   The replacement queue system works for live traffic but is skipped by bulk importers.
*   "Points" stats were briefly considered but discarded as EDK does not track zKillboard-style points.
*   The calculation relies on `pg_total_relation_size` logic discussed previously for database sizing, but here we focus on `SUM` and `COUNT`.

## Future Considerations

*   **Performance:** The command processes month-by-month to be memory efficient, but for 100M+ killmails, it will still take time (likely hours).
*   **Double Counting:** If you run this command *without* `--truncate` on data that has *already* been processed, it will increment the stats again (double counting). **Always use `--truncate` for a clean state unless you are absolutely sure you are processing a new, untouched date range.**
*   **Concurrency:** Do not run this command while other backfills or the live queue is running, as `TRUNCATE` locks the table, and upserts might contend with live updates. Ideally, run this during maintenance or after backfills are complete.
