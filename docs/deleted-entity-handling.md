# Deleted Entity Handling Implementation

## Overview

Implemented automatic detection and filtering of deleted/biomassed characters to prevent repeated ESI API errors.

**Note**: Only characters can be deleted in EVE Online. Corporations and alliances cannot be deleted - they may close or disband, but their records persist in ESI.

## Changes Made

### 1. Database Migration (db/90-add-deleted-flag.sql)

Added `deleted` boolean column to characters table:

- `characters.deleted` - Tracks biomassed/deleted characters

Includes index for efficient filtering: `WHERE deleted = FALSE`

### 2. Character Fetcher (server/fetchers/character.ts)

- **404/400 responses**: Automatically marks character as deleted in database
- **Success responses**: Unmarks character as deleted (handles restorations)
- **Functions added**:
  - `markCharacterAsDeleted()` - Sets deleted flag and updates timestamp
  - `unmarkCharacterAsDeleted()` - Clears deleted flag if character is restored

### 3. Affiliation Update Command (commands/affiliation-update.ts)

- **Query filtering**: Excludes deleted characters from both active/inactive queries
  - `AND (deleted = FALSE OR deleted IS NULL)`
- **Binary search handling**: The affiliation endpoint returns 400 if ANY character is deleted
  - Splits batch in half recursively when 400 error occurs
  - Continues until isolated to single character
  - Checks individual character endpoint to confirm deletion
- **Function added**: `checkIndividualCharacter()` - Verifies if a single character is deleted via GET endpoint

## Benefits

1. **Reduced API Errors**: No more repeated 400 errors for deleted entities
2. **Better Performance**: Filters out deleted entities before making ESI calls
3. **Automatic Cleanup**: Deleted entities are automatically detected and flagged
4. **Restoration Support**: If an entity is restored, the flag is automatically cleared
5. **Binary Search Isolation**: Efficiently isolates deleted characters in large batches using recursive splitting
6. **Precise Detection**: Only marks characters as deleted when ESI explicitly returns "Character not found"

## Usage

### Filtering Deleted Characters in Queries

```typescript
// Get only non-deleted characters
const activeChars = await database.query(`
  SELECT * FROM characters
  WHERE deleted = FALSE OR deleted IS NULL
`);
```

### Finding Deleted Characters

```typescript
// Find all deleted characters
const deletedChars = await database.query(`
  SELECT "characterId", name, "updatedAt"
  FROM characters
  WHERE deleted = TRUE
`);
```

## How the Affiliation Endpoint Works

The ESI `/characters/affiliation/` endpoint has a quirky behavior:

- Accepts up to 1000 character IDs in a single POST request
- Returns 400 error with `{"error": "Invalid character ID"}` if **ANY** character in the batch is deleted/invalid
- Does not indicate which character(s) are problematic

### Our Solution: Binary Search

1. Try the full batch (e.g., 1000 characters)
2. If 400 error: Split in half (500 + 500)
3. Try each half in parallel
4. Continue splitting until isolated to single characters
5. Check single characters via GET `/characters/{id}/` to confirm deletion
6. Mark as deleted only if ESI returns 404 with `"Character not found"`

## Testing

Test with characters that may be deleted:

```bash
bun cli affiliation-update
```

The command will:

- Filter out already-deleted characters from queries
- Handle 400 errors by recursively splitting batches
- Precisely identify and mark deleted characters

## Notes

- The `deleted` flag is **only** set when ESI returns 404 with explicit "Character not found" error message
- The flag is cleared if a subsequent ESI call succeeds (handles character restorations/un-biomassing)
- Binary search ensures we isolate problematic characters without excessive API calls
- The character queue processor automatically uses this logic via the fetcher function
- **Only characters have the deleted flag** - corporations and alliances cannot be deleted in EVE Online
