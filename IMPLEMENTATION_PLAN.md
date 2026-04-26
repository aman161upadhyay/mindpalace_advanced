# Mind Palace — Implementation Plan

## Overview

Mind Palace is a two-part system: a **Chrome Extension (Manifest V3)** that captures text selections from any webpage, and a **web dashboard** (React + tRPC + MySQL) that stores, organises, and presents the captured highlights as a searchable knowledge base.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension (MV3)                 │
│                                                         │
│  content.js          background.js         popup.html   │
│  ─────────────       ────────────────      ──────────── │
│  • Detect Ctrl+      • Relay keyboard      • Show 5     │
│    Shift+S           • Handle context      recent saves │
│  • Capture           menu click            • Link to    │
│    selection +       • POST to API         dashboard    │
│    metadata          • GET recent          • Settings   │
│  • Show tooltip      • Store token         panel        │
└──────────────────────────────┬──────────────────────────┘
                               │ HTTPS / tRPC JSON
                               ▼
┌─────────────────────────────────────────────────────────┐
│                  Web Dashboard (Node.js)                 │
│                                                         │
│  /api/trpc/extension.saveHighlight  (public + token)    │
│  /api/trpc/extension.getRecent      (public + token)    │
│  /api/trpc/highlights.*             (protected session) │
│  /api/trpc/tags.*                   (protected session) │
│  /api/trpc/tokens.*                 (protected session) │
└──────────────────────────────┬──────────────────────────┘
                               │ Drizzle ORM
                               ▼
                    ┌──────────────────┐
                    │   MySQL / TiDB   │
                    │  highlights      │
                    │  tags            │
                    │  api_tokens      │
                    │  users           │
                    └──────────────────┘
```

---

## Data Model

### `highlights`

| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| userId | INT FK → users.id | |
| text | TEXT | The captured text (max 50,000 chars) |
| sourceUrl | VARCHAR(2048) | Full URL of the source page |
| pageTitle | VARCHAR(512) | `document.title` at capture time |
| domain | VARCHAR(255) | Extracted hostname (e.g. `gemini.google.com`) |
| notes | TEXT NULL | User-added personal annotations |
| tagIds | VARCHAR(512) | JSON array of tag IDs, e.g. `[1,3]` |
| createdAt | TIMESTAMP | UTC, set on insert |
| updatedAt | TIMESTAMP | UTC, updated on change |

### `tags`

| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| userId | INT FK → users.id | |
| name | VARCHAR(64) | Display name |
| color | VARCHAR(16) | Hex colour, e.g. `#6366f1` |
| createdAt | TIMESTAMP | |

### `api_tokens`

| Column | Type | Notes |
|---|---|---|
| id | INT AUTO_INCREMENT PK | |
| userId | INT FK → users.id | |
| token | VARCHAR(64) UNIQUE | `hc_` + 32-char random hex |
| label | VARCHAR(128) NULL | Human-readable label |
| createdAt | TIMESTAMP | |

---

## Chrome Extension Flow

1. User selects text on any webpage (including Gemini, research papers, news sites).
2. User presses **Ctrl+Shift+S** (Mac: Cmd+Shift+S) — or right-clicks and selects "Save to Mind Palace".
3. `content.js` intercepts the keyboard event, reads `window.getSelection().toString()`, and sends a `SAVE_HIGHLIGHT` message to `background.js`.
4. `background.js` reads the API token and dashboard URL from `chrome.storage.sync`, then POSTs to `/api/trpc/extension.saveHighlight` with the payload.
5. The server validates the API token, resolves the user, and inserts the highlight into the database.
6. `background.js` sends the result back to `content.js`, which shows a **confirmation tooltip** (green for success, red for error) near the cursor for 2.5 seconds.
7. The popup's "Recent Highlights" list is populated by calling `/api/trpc/extension.getRecent`.

---

## API Contracts

### `extension.saveHighlight` (POST, public + token)

**Input:**
```json
{
  "apiToken": "hc_...",
  "text": "Selected text content",
  "sourceUrl": "https://example.com/page",
  "pageTitle": "Page Title",
  "domain": "example.com"
}
```

**Output:** The created highlight object.

### `extension.getRecent` (GET, public + token)

**Input:** `{ apiToken, limit }` (via query string `?input=...`)

**Output:** Array of the most recent N highlights (default 5).

---

## Dashboard Features

| Feature | Implementation |
|---|---|
| Full-text search | `highlights.list({ search })` — SQL `LIKE` on text, pageTitle, domain, notes |
| Tag filtering | `highlights.list({ tagId })` — JSON_CONTAINS on tagIds column |
| Domain filtering | `highlights.list({ domain })` — exact match on domain column |
| Domain grouping | Client-side grouping when no filters are active |
| Highlight detail | `highlights.getById` + inline notes/tag editor |
| Tag management | `tags.create`, `tags.delete` with colour picker |
| Export JSON | Serialises all highlights + resolved tag names to JSON |
| Export Markdown | Formats each highlight as a blockquote with source, date, tags, notes |
| API token management | `tokens.create` (generates `hc_` prefixed token), `tokens.list`, `tokens.delete` |
| Pagination | Offset-based, 30 items per page |

---

## Authentication

The dashboard uses **Manus OAuth** (session cookie). The Chrome extension uses **API tokens** — long-lived bearer tokens stored in `chrome.storage.sync` that bypass the session cookie requirement. Each token is tied to a specific user and can be revoked at any time from the Settings page.

---

## Security Considerations

- API tokens are stored in `chrome.storage.sync` (encrypted by Chrome, not accessible to web pages).
- The extension only sends data to the user-configured dashboard URL — no third-party endpoints.
- All dashboard procedures use `protectedProcedure` (session-based auth) except the two extension endpoints which validate via API token.
- Tokens are prefixed with `hc_` to make them identifiable and easy to rotate.
- Text is sanitised server-side and stored as plain text (no HTML injection risk).

---

## Test Strategy

Tests are written with **Vitest** and mock the database layer. Key test cases:

- `highlights.create` — valid payload, empty text rejection, invalid URL rejection.
- `highlights.list` — returns all items, filters by search term, returns empty on no match.
- `highlights.export` — JSON output has correct structure, Markdown output contains expected headings and content.
- `tags.create` — valid tag, invalid hex colour rejection.
- `auth.logout` — clears session cookie and returns success.

All 12 tests pass as of the initial release.

---

## Extension Installation (Step-by-Step)

1. Sign in to the dashboard and go to **Settings**.
2. Click **New Token** to generate an API token — copy it.
3. Note your dashboard URL (shown in Settings).
4. Download the extension ZIP from the Settings page and extract it.
5. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the extracted folder.
6. Click the extension icon, open **Settings**, paste your API token and dashboard URL, and click **Save**.
7. Select text on any webpage and press **Ctrl+Shift+S** — a purple tooltip confirms the save.
