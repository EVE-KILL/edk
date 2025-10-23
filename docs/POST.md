# Post Killmail Feature

## Overview
A user-friendly interface for posting killmails from ESI to EDK. Users can paste ESI URLs or JSON data, and the system will automatically fetch and process the killmail.

## Features

### 1. User Interface (`/templates/pages/post.hbs`)
- **Centered design** with clear instructions
- **Keyboard shortcut display** showing Ctrl+V (⌘+V on Mac)
- **Multi-input support**:
  - Textarea for manual paste
  - Global paste listener for quick submissions
  - Submit button for manual triggering
- **Real-time feedback**:
  - Loading spinner during processing
  - Success/error messages
  - Automatic redirect on success

### 2. JavaScript (`/static/post.js`)
- **Automatic paste detection**: Intercepts Ctrl+V/⌘+V anywhere on the page
- **Auto-submission**: Automatically submits when data is pasted
- **Manual submission**: Button click and Ctrl+Enter in textarea
- **Status updates**: Shows loading, success, and error states
- **Auto-redirect**: Redirects to killmail page after successful post

### 3. Backend Handler (`/app/routes/post.ts`)

#### GET Request
- Renders the post page

#### POST Request
Handles killmail submission with the following flow:

1. **Parse Input** - Supports multiple formats:
   - ESI URL: `https://esi.evetech.net/latest/killmails/{id}/{hash}/`
   - JSON with `killmail_id` and `zkb.hash`
   - JSON with `killID` and `zkb.hash` (RedisQ format)
   - Full RedisQ package with `package.killID`

2. **Check Existence**
   - Queries database to see if killmail already exists
   - If exists, immediately returns URL to existing killmail

3. **Enqueue Processing**
   - Creates a `killmail-fetch` job with killmailId and hash
   - Uses the same JobDispatcher as RedisQ command

4. **Wait for Completion**
   - Polls database every 500ms
   - 30-second timeout
   - Returns killmail URL once processing is complete

5. **Response**
   - Success: `{ success: true, url: "/killmail/{id}", message: "..." }`
   - Error: `{ success: false, error: "..." }`

## Supported Input Formats

### ESI URL
```
https://esi.evetech.net/latest/killmails/123456789/abc123def456/
```

### zKillboard JSON (Simple)
```json
{
  "killmail_id": 123456789,
  "zkb": {
    "hash": "abc123def456"
  }
}
```

### RedisQ Format
```json
{
  "killID": 123456789,
  "zkb": {
    "hash": "abc123def456"
  }
}
```

### Full RedisQ Package
```json
{
  "package": {
    "killID": 123456789,
    "zkb": {
      "hash": "abc123def456"
    }
  }
}
```

## Flow Diagram

```
User pastes data
    ↓
JS intercepts paste
    ↓
POST to /post endpoint
    ↓
Parse killmailId & hash
    ↓
Check if exists in DB
    ↓ (if new)
Enqueue killmail-fetch job
    ↓
Poll DB for completion
    ↓
Return killmail URL
    ↓
JS redirects to killmail page
```

## Processing Details

The post endpoint uses the same processing pipeline as RedisQ:

1. **killmail-fetch worker** fetches from ESI and saves to database
2. **Entity fetchers** enqueue jobs for characters, corporations, alliances, systems, types
3. **Price fetcher** calculates killmail value
4. All related entities are fetched and cached

## Error Handling

- **Invalid input**: Returns 400 with error message
- **Processing timeout**: Returns 408 after 30 seconds
- **Server errors**: Returns 500 with error details
- **Duplicate killmail**: Immediately returns existing killmail URL

## User Experience

1. Navigate to `/post`
2. Press Ctrl+V (or ⌘+V) with ESI URL or JSON in clipboard
3. See "Processing killmail..." message
4. Automatically redirected to killmail page when ready
5. Or see error message if something goes wrong

## Future Enhancements

- [ ] Support for multiple killmails at once
- [ ] Progress bar for processing steps
- [ ] Recent posts list
- [ ] Validation preview before submission
- [ ] Support for battle report URLs
- [ ] Import from other killboards
