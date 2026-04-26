# Mind Palace — Full Product Design Spec
**Date:** 2026-04-15
**Status:** Approved

---

## Overview

Mind Palace is a public knowledge-capture product: a Chrome/Edge browser extension paired with a web dashboard. Any user on the internet can register, install the extension, and build a personal highlight library by selecting text on any webpage and pressing `Ctrl+Shift+S`. The extension auto-configures after a single login — no manual token pasting.

---

## Architecture

### Stack
- **Frontend:** React + Vite + TypeScript, deployed to Vercel CDN
- **Backend:** Vercel Serverless Functions (`/api/**`)
- **Database:** Neon Postgres (free tier, ~0.5 GB) via Drizzle ORM
- **Auth:** bcrypt password hashing + JWT signed into httpOnly cookie (30-day expiry)
- **Extension:** Chrome/Edge Manifest V3, distributed as unpacked or via Chrome Web Store

### Hosting
Single `vercel deploy` deploys everything. No separate server process. `vercel.json` configures rewrites so all `/api/*` calls route to serverless functions and all other routes serve the React SPA.

### Layers
```
[Extension]  [React Dashboard]
        ↓          ↓
   [Vercel Serverless API Functions]
              ↓
        [Neon Postgres]
```

---

## Authentication

### Registration & Login
- Username + email + password (no OAuth)
- Password hashed with bcrypt (12 rounds)
- On login: server signs JWT `{ userId, username }`, sets in `httpOnly; Secure; SameSite=Lax` cookie named `mp_session`
- Cookie expiry: 30 days
- All protected API routes verify JWT via a shared `requireAuth(req)` helper

### Extension Auth
- Extension uses a separate **API token** (not the JWT cookie) — format: `hc_` + nanoid(40)
- Stored in `chrome.storage.sync` (encrypted by Chrome)
- API token is auto-pushed to extension after login via the existing DOM bridge (`HC_SAVE_SETTINGS` custom event)
- Extension never needs manual configuration

### Session Check
- `GET /api/auth/me` — returns `{ id, username, email, theme }` or 401
- `useAuth()` hook calls this on app mount; stores result in React context
- Unauthenticated users on `/mind-palace` or `/settings` are redirected to `/login`

---

## Database Schema (Postgres)

### `users`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| username | varchar(64) unique | |
| email | varchar(255) unique | |
| password_hash | varchar(255) | bcrypt |
| theme | varchar(10) | `'dark'` or `'light'`, default `'dark'` |
| created_at | timestamp | |
| updated_at | timestamp | |

### `api_tokens`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | integer FK → users | |
| token | varchar(128) unique | `hc_` + nanoid(40) |
| label | varchar(128) nullable | |
| created_at | timestamp | |

### `tags`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | integer FK → users | |
| name | varchar(64) | |
| color | varchar(7) | hex e.g. `#6366f1` |
| created_at | timestamp | |

### `highlights`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | integer FK → users | |
| text | text | selected text |
| source_url | text | |
| page_title | varchar(512) | |
| domain | varchar(255) | |
| notes | text nullable | |
| tag_ids | varchar(1024) | JSON array string `[1,2,3]` |
| metadata_tags | varchar(1024) | JSON array of keyword-inferred tag strings (e.g. "AI", "Design") |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## API Routes (Vercel Serverless Functions)

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create account, set JWT cookie |
| POST | `/api/auth/login` | public | Validate password, set JWT cookie |
| POST | `/api/auth/logout` | public | Clear JWT cookie |
| GET | `/api/auth/me` | JWT | Return current user |
| PATCH | `/api/auth/me` | JWT | Update theme preference |

### Highlights
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/highlights` | JWT | List with search/tag/domain/pagination |
| POST | `/api/highlights` | JWT | Create highlight |
| PATCH | `/api/highlights/[id]` | JWT | Update notes/tagIds |
| DELETE | `/api/highlights/[id]` | JWT | Delete |
| GET | `/api/highlights/domain-stats` | JWT | Top domains by count |
| GET | `/api/highlights/export` | JWT | JSON or Markdown export |

### Tags
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tags` | JWT | List user's tags |
| POST | `/api/tags` | JWT | Create tag |
| DELETE | `/api/tags/[id]` | JWT | Delete tag |

### Tokens
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tokens` | JWT | List user's API tokens |
| POST | `/api/tokens` | JWT | Generate new token |
| DELETE | `/api/tokens/[id]` | JWT | Revoke token |

### Extension (API token auth)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/extension/save` | API token | Save highlight from extension |
| GET | `/api/extension/recent` | API token | Get 5 most recent highlights |

---

## Extension

### Files (all in `/extension`)
- `manifest.json` — MV3, permissions: storage, activeTab, scripting, contextMenus
- `background.js` — handles messages, calls API, manages chrome.storage.sync. Contains the configured deployed Vercel URL (for example `https://mind-palace-v2.vercel.app`) only through extension settings, not hardcoded secrets.
- `content.js` — keyboard shortcut listener, silent toast, first-time tutorial, DOM bridge
- `popup.html` + `popup.js` — luxury UI with both themes

> **Note:** `server.cjs` (the old local Express demo server) is deleted. All API work moves to `/api/` Vercel functions.

### Popup States
1. **Not configured** — Shows logo, tagline, "Create free account" + "Sign in" buttons. Opens `yoursite.com/register` or `/login` in new tab.
2. **Logged in** — Shows recent 5 highlights, "Open Dashboard" button, settings gear icon.
3. **Settings view** — Shows connection status, theme toggle (dark/light), manual override fields (URL + token).

### Themes
- **Dark (Obsidian + Cream):** Background `#0c0b09`, accent `linear-gradient(135deg, #c9b99a, #e8d9c0)`, text `#f5efe6`
- **Light (Parchment + Warm Brown):** Background `#faf8f5`, accent `linear-gradient(135deg, #8a7560, #b5a080)`, text `#1a1510`
- Theme stored in `chrome.storage.sync` as `{ theme: 'dark' | 'light' }`
- Extension and dashboard themes stay in sync via the bridge on login

### Auto-Config Flow
1. User installs extension → popup shows onboarding state
2. User clicks "Create account" → `yoursite.com/register` opens
3. User registers and lands on dashboard
4. Dashboard detects extension: `document.documentElement.dataset.hcExtension === 'true'`
5. Dashboard dispatches `HC_SAVE_SETTINGS` with `{ apiToken, dashboardUrl, theme }`
6. Extension content script receives event, stores in `chrome.storage.sync`
7. Extension is fully configured — popup now shows recent highlights

### Save Flow
**First time ever:**
- Full tutorial popup appears anchored near selection
- Shows: "Saved! ✦" with the captured text preview
- Explains: "Press Ctrl+Shift+S anytime to save highlights"
- Shows "Add a note →" and "Add tags →" action buttons
- Dismiss button

**All subsequent saves:**
- Small silent toast (bottom-right, 3s duration): `"✦ Saved — [page title truncated]"`
- Inline "＋ Note" button on the toast — clicking opens a mini textarea overlay
- Toast fades out smoothly; overlay stays open if clicked

---

## Web Dashboard Pages

### `/` — Home (Landing)
- Hero section with product headline
- Feature grid (6 cards)
- CTA: "Get started free" → `/register`
- Shows "Go to your Mind Palace ->" if already logged in

### `/login` — Login
- Luxury card centered on page, both themes
- Username + Password fields
- "Sign in" button
- Link to `/register`
- Error states inline (not alert boxes)

### `/register` — Register
- Same luxury card
- Username + Email + Password + Confirm Password
- "Create account" button
- Link to `/login`
- On success: redirect to `/mind-palace`, auto-push token to extension if present

### `/mind-palace` — Main Dashboard
- Protected route (redirect to `/login` if not authed)
- Search bar, tag filter, domain filter
- Highlight cards with source, date, tags, text preview
- Detail modal on click
- Export button (JSON / Markdown)
- Pagination (30 per page)

### `/settings` — Settings
- Protected route
- **Account section:** username, email
- **Theme section:** Toggle switch Dark ↔ Light (saves to DB + syncs extension)
- **API Tokens section:** List tokens, create new, copy, delete
- **Extension section:** Connection status badge, "Push settings to extension" button, manual URL/token fields
- **Keyboard shortcut info:** `Ctrl+Shift+S` / `Cmd+Shift+S`

### `/404` — Not Found

---

## Theme System

- Theme stored in `users.theme` column (persists across devices)
- `ThemeContext` reads from `useAuth()` user object, applies `data-theme="dark"` or `data-theme="light"` to `<html>`
- CSS uses `[data-theme="dark"]` and `[data-theme="light"]` selectors for all color variables
- Toggling theme: PATCH `/api/auth/me` with `{ theme }`, then update context + re-apply to DOM
- Extension reads theme from `chrome.storage.sync`, applies matching CSS class to popup

---

## Deployment

### `vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Environment Variables (set in Vercel dashboard)
- `DATABASE_URL` — Neon Postgres connection string
- `JWT_SECRET` — random 64-char secret

### Local Development
- `npm run dev` — Vite dev server on port 5173
- `vercel dev` — runs serverless functions locally on port 3000
- `.env.local` — `DATABASE_URL` and `JWT_SECRET` for local dev

### `.gitignore` additions
- `.env.local`
- `.superpowers/`

---

## Out of Scope (v1)
- OAuth (Google, GitHub login)
- Email verification
- Password reset via email
- Ollama/AI auto-tagging (removed — serverless-incompatible). Simple keyword matching is kept: a small regex list maps words in the highlight text to broad category tags (AI, Design, Security, etc.) and stored in `metadata_tags`.
- Real-time sync between tabs
- Mobile app
- Team/shared knowledge bases
- Chrome Web Store publishing (extension distributed as unpacked ZIP for v1)
