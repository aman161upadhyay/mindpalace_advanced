# Mind Palace v2 — Full Project Context

> Last updated: 2026-05-31 (final — AI chat working in production)

---

## 1. What Is Mind Palace?

Mind Palace is a **Chrome extension + web dashboard** that lets users highlight text on any webpage, save those highlights to a cloud database, and revisit/search/organize them later. Think of it as a personal knowledge base built from web highlights.

- **Chrome Extension**: Users highlight text on any page, click "Save to Mind Palace," and the highlight is sent to the API.
- **Web Dashboard** (React SPA): Users log in at the Vercel-hosted URL, browse all their highlights, search, filter by source/tags, view details, manage trash, export, and now chat with an AI about their highlights.

---

## 2. Deployments & URLs

### Production (Professor's — DO NOT TOUCH)
- The **original** Vercel deployment is being used by the user's course professor.
- Do **not** redeploy, modify env vars, or make any changes to that deployment.
- It runs off the original Vercel project linked to this repo.

### v2 Development Deployment
- **URL**: https://mind-palace-v2.vercel.app
- **Vercel project**: `mind-palace-v2` (under user `amanupadhyay`)
- **GitHub repo**: https://github.com/aman161upadhyay/mindpalace_advanced
- **Production branch**: `main` (Vercel auto-deploys from `main`)
- **Development branch**: `v2-updates` (merged into `main` for deployment)
- **Git worktree location**: `M:\AI\01MindPalace\Knowledge_Area51\.worktrees\v2-updates`

### Chrome Web Store
- **Published**: https://chromewebstore.google.com/detail/mind-palace/hfjlflceaophbbeadanbpibaaidbjoao
- Extension files are in `extension/` directory

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS 4, Wouter (routing), Sonner (toasts) |
| UI Components | shadcn/ui (Button, Input, Dialog, etc.), Lucide React (icons) |
| Backend | Vercel Serverless Functions (Node.js), `@vercel/node` |
| Database | Neon Postgres (serverless), Drizzle ORM |
| Auth | JWT-based (jose library v4), bcryptjs for password hashing |
| AI Chat | Vertex AI Gemini 3.1 Flash-Lite via REST API, GCP service account JWT auth |
| Email | Resend (for password reset emails) |
| Styling | Custom dark/light themes (moss green + warm plaster), Google Fonts (Inter, Lexend, Lora, JetBrains Mono, Playfair Display) |

---

## 4. Vercel Constraints

- **Hobby plan**: Maximum **12 serverless functions**
- Current count: **12** (at limit)
- Functions count as any `.ts` file inside `api/` directory
- To add a new endpoint, an existing one must be merged or removed first

### Current API Endpoints (12 total)

```
api/auth/login.ts          — POST: login with email/password, returns JWT cookie
api/auth/logout.ts         — POST: clears JWT cookie
api/auth/me.ts             — GET: returns current user from JWT
api/auth/register.ts       — POST: create new account
api/auth/reset-password.ts — POST: reset password via email token
api/chat/index.ts          — POST: AI chat (question → Gemini → answer)
api/extension/index.ts     — GET: recent highlights, POST: save highlight (merged from recent+save)
api/highlights/index.ts    — GET: list/search/filter, POST: create, PATCH: update/restore, DELETE: soft/hard delete
api/tags/[id].ts           — PATCH/DELETE individual tag
api/tags/index.ts          — GET: list tags, POST: create tag
api/tokens/[id].ts         — DELETE individual API token
api/tokens/index.ts        — GET: list tokens, POST: create token
```

### vercel.json Configuration

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PATCH, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/tags/:id", "destination": "/api/tags?id=:id" },
    { "source": "/api/tokens/:id", "destination": "/api/tokens?id=:id" },
    { "source": "/api/extension/recent", "destination": "/api/extension" },
    { "source": "/api/extension/save", "destination": "/api/extension" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 5. Environment Variables (Vercel)

These must be set in the Vercel dashboard for **Production + Preview + Development**:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon Postgres direct connection (for migrations) |
| `JWT_SECRET` | Secret for signing/verifying JWT auth tokens |
| `RESEND_API_KEY` | Resend API key for password reset emails |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Base64-encoded** minified JSON of GCP service account key (for Vertex AI). MUST be base64, not raw JSON — Vercel corrupts raw JSON escape sequences. |

### GCP Service Account Details
- **Project**: `agentlanggraph`
- **Service account**: `hermes-vertex@agentlanggraph.iam.gserviceaccount.com`
- **Role**: `roles/aiplatform.user`
- **Key file location** (local): `M:\AI\01MindPalace\Knowledge_Area51\agentlanggraph-54f9a0f59d89.json`
- **Model used**: `gemini-3.1-flash-lite` via `aiplatform.googleapis.com` (location: `global`)
- **Important**: Gemini 3.x models require `global` location, NOT `us-central1`. The URL format is `https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/...` (no region prefix on the domain)

---

## 6. Database Schema (Drizzle ORM)

Defined in `src/schema.ts`. Four tables:

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| username | varchar(64) | unique |
| email | varchar(255) | unique |
| password_hash | varchar(255) | bcryptjs |
| theme | varchar(10) | default "dark" |
| daily_email_enabled | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

### `api_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | integer FK → users | cascade delete |
| token | varchar(128) | unique |
| label | varchar(128) | |
| created_at | timestamp | |

### `tags`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | integer FK → users | cascade delete |
| name | varchar(64) | |
| color | varchar(7) | default "#6366f1" |
| created_at | timestamp | |

### `highlights`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | integer FK → users | cascade delete |
| text | text | the highlighted content |
| source_url | text | URL where highlight was captured |
| page_title | varchar(512) | |
| domain | varchar(255) | e.g. "chatgpt.com" |
| notes | text | nullable, user's personal notes |
| tag_ids | varchar(1024) | JSON array of tag IDs, e.g. "[1,3]" |
| metadata_tags | varchar(1024) | JSON array of auto-inferred keyword tags |
| created_at | timestamp | |
| updated_at | timestamp | |
| deleted_at | timestamp | nullable — soft delete (trash) |

### Migration Files
- `drizzle/0001_init.sql` — initial schema
- `drizzle/0002_soft_delete.sql` — `ALTER TABLE highlights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`
- Manually applied: `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_email_enabled BOOLEAN NOT NULL DEFAULT false;`

---

## 7. Frontend Architecture

### Routing (Wouter)
Defined in `src/App.tsx`:

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | `Home.tsx` | Landing page with animated hero |
| `/login` | `Login.tsx` | Login form |
| `/register` | `Register.tsx` | Registration form |
| `/forgot-password` | `ForgotPassword.tsx` | Password reset request |
| `/mind-palace` | `MindPalace.tsx` | Main dashboard (auth required) |
| `/settings` | `Settings.tsx` | User settings, API tokens, theme |
| `/faq` | `FAQ.tsx` | FAQ page |
| `/privacy` | `Privacy.tsx` | Privacy policy |
| `/contact` | `Contact.tsx` | Contact page |

### MindPalace.tsx — Main Dashboard

This is the largest and most complex component (~1300+ lines). Key features:

- **Sidebar**: Sources list (grouped by domain), tags filter, topics (metadata tags), export, trash, settings links
- **Header**: Search bar with real-time filtering + "Ask AI" button for chat panel
- **Highlight Cards**: Display highlight text (Lexend font), source, date, metadata tags, one-click delete (trash icon on hover)
- **Highlight Detail Modal**: Two-column landscape layout (`max-w-6xl`, `grid-cols-[1fr_200px]`), left = full text at 13px, right = metadata/tags/notes
- **Trash System**: Soft-deleted highlights viewable in a dialog, with Restore and Delete Forever buttons
- **AI Chat Panel**: Collapsible panel below the header, message thread with user/AI bubbles, loading indicator, auto-scroll
- **Pagination**: 30 items per page, server-side

### Styling
- **Dark theme**: Deep charcoal + moss green (#4e6a57 primary)
- **Light theme**: Warm plaster (#eae6df) + deep moss (#2e4036)
- **Highlight text font**: Lexend 400 weight (non-italic)
- **Body font**: Inter
- Custom scrollbar, noise overlay, glass panel effects, gradient text utility

### Key Libraries in Frontend
- `src/lib/auth.ts` — JWT verification (`getAuthUserIdFromVercelReq`)
- `src/lib/cors.ts` — CORS handler (`applyCors`)
- `src/lib/db.ts` — Drizzle + Neon serverless connection
- `src/lib/keyword-tags.ts` — `inferTags()` for auto-tagging highlights
- `src/lib/rate-limit.ts` — In-memory rate limiter
- `src/lib/vertex.ts` — Vertex AI auth + `callGemini()` helper

---

## 8. AI Chat Feature (Newly Added 2026-05-31)

### How It Works

1. User clicks "Ask AI" button in the dashboard header
2. Chat panel slides open below the header
3. User types a natural-language question (e.g., "What have I saved about AI?")
4. Frontend POSTs to `/api/chat` with `{ question }` and auth cookie
5. Backend:
   - Authenticates user via JWT
   - Fetches up to 300 of their highlights from DB
   - Builds a compact context string with highlight text (truncated to 800 chars), source, tags, notes, dates
   - Calls Vertex AI Gemini 3.1 Flash-Lite with a system instruction + user question
   - Returns `{ answer }` to frontend
6. Answer appears as an AI message bubble in the chat panel

### Vertex AI Auth Flow (`src/lib/vertex.ts`)
1. Read `GOOGLE_SERVICE_ACCOUNT_JSON` env var (base64-encoded)
2. Base64-decode → JSON.parse to get service account key object
3. Sign a JWT assertion with the service account's private key (RS256, via `jose` library's `importPKCS8`)
4. Exchange JWT for a short-lived OAuth2 access token at `https://oauth2.googleapis.com/token`
5. Cache the token (refreshed 60s before expiry)
6. Use the access token as a Bearer token to call `aiplatform.googleapis.com/v1/projects/agentlanggraph/locations/global/publishers/google/models/gemini-3.1-flash-lite:generateContent`

### How to Generate the Base64 Env Var
```bash
node -e "const fs=require('fs'); const j=JSON.stringify(JSON.parse(fs.readFileSync('path/to/key.json','utf8'))); console.log(Buffer.from(j).toString('base64'))"
```
Paste the output into Vercel as `GOOGLE_SERVICE_ACCOUNT_JSON`.

### Rate Limit
- 20 requests per minute per IP on the chat endpoint

---

## 9. Chrome Extension

Located in `extension/` directory.

- **manifest.json**: Manifest V3, permissions for `activeTab`, `storage`, `contextMenus`
- **content.js**: Injects into pages, captures text selections
- **background.js**: Handles context menu "Save to Mind Palace", sends highlight to API
- **popup.html/popup.js**: Extension popup showing recent highlights, settings
- Uses API tokens (not JWT cookies) for auth — tokens managed in Settings page

---

## 10. Git History (Key Commits, Newest First)

```
db23f7f Use base64-encoded env var to avoid Vercel escape corruption entirely
4cce81a Use loop-based invalid escape removal instead of regex (avoids regex edge cases)
2601bc6 Reconstruct clean PEM key from base64 after JSON parse to handle Vercel corruption
2141d8b Fix env var: remove invalid backslash escapes (Vercel corrupts \n to \ + space)
ffb0a99 Fix env var double-escaping: Vercel stores quotes as \" and newlines as \\n
067ebf9 Fix PEM key: normalize literal \n to real newlines after JSON parse
8720b1e Robust env var parsing: try/catch cascade for multiple Vercel newline mangling formats
b3927b7 Fix env var parsing: strip all newlines instead of re-escaping
dd39898 Update CONTEXT.md with Vertex AI fixes, correct model/location, and new gotchas
9cc2e44 Fix JSON parse of service account key: re-escape newlines mangled by Vercel env vars
89c7462 Show actual error message in chat response for debugging
62a867c Fix Vertex AI: use gemini-3.1-flash-lite at global location (not us-central1)
7f61a78 Add AI chat panel to dashboard — Ask AI button toggles inline chat powered by Vertex AI
ab02fbe Add /api/chat endpoint: answers questions about user highlights using Vertex AI Gemini
8915e62 Add Vertex AI auth helper and callGemini() using service account JWT
d816c1f Merge extension/recent and extension/save into extension/index to free function slot
12cdc9a Increase Lexend font weight from 300 to 400 for better readability
d593638 Shrink right panel to 200px so left text column gets more width
6a55f64 Change highlight card font to Lexend (light weight)
011e5aa Widen highlight modal: max-w-6xl, fixed 280px right panel
935a405 test: Verify Vercel Git integration auto-deploy
60bb1d6 Redesign highlight detail modal: landscape two-column layout, smaller font
9a0040c Fix restore from trash: move restore PATCH handler before generic PATCH
223aa7c Restore reset-password API endpoint
ce398f3 Reduce serverless function count to fit Hobby plan (max 12)
f2f0dc7 Add soft delete / trash with restore and permanent delete
d7ce1e6 Remove italic styling from highlights; add one-click delete button to cards
35a4652 Sync v2-updates with working source from mindpalace repo
dd2cbbe Complete Mind Palace rebrand: rename Compendium to MindPalace, add v2 deployment plan
5513150 Add .worktrees/ to .gitignore for git worktree support
4a39190 Rename project from Highlight Compendium to Mind Palace v2
3ac24f4 Prepare Mind Palace project for advanced repository
```

---

## 11. Bugs Fixed Along the Way

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| 14 serverless functions > 12 limit | Too many API files | Removed `api/highlights/[id].ts`, `api/cron/daily-highlights.ts`; merged extension endpoints |
| "Internal server error" on login | `JWT_SECRET` missing from Preview env; `daily_email_enabled` and `deleted_at` columns missing from DB | Added env var via dashboard; ran ALTER TABLE manually |
| Restore button in trash not working | Generic PATCH handler caught all PATCH requests before restore handler | Moved `PATCH+action=restore` check before generic `PATCH` in the if-chain |
| Highlight modal too narrow/portrait | `max-w-3xl` single column | Changed to `max-w-6xl` two-column grid layout |
| Right column too wide | `grid-cols-[3fr_2fr]` gave right panel too much space | Changed to `grid-cols-[1fr_200px]` (fixed right, flexible left) |
| Lexend font too thin | font-weight: 300 | Changed to font-weight: 400 |
| Vercel deploying stale code | Vercel watching `main` branch, all work on `v2-updates` | Merged `v2-updates` into `main`, pushed to origin |
| AI chat "Failed to generate answer" (404) | Model `gemini-2.0-flash-lite` doesn't exist; `us-central1` location doesn't serve Gemini 3.x models | Changed to `gemini-3.1-flash-lite` at `global` location in `vertex.ts` |
| AI chat "Bad control character in JSON" | Vercel corrupts `\n` escape sequences in env vars — converts to real newlines, corrupts some to `\` + space, double-escapes others | Switched to base64-encoding the entire JSON key. Code does `Buffer.from(raw, "base64").toString("utf8")` before `JSON.parse()`. Completely immune to Vercel's escape mangling. |
| AI chat "pkcs8 must be PKCS#8 formatted string" | After Vercel corrupted `\n` → `\` + space in the PEM key, the base64 data was damaged (extra chars). String-level fixes couldn't reliably reconstruct the key. | Solved by base64-encoding approach above — the PEM key arrives intact. |

---

## 12. Highlights API Details (`api/highlights/index.ts`)

This is the most complex endpoint. It handles all highlight CRUD via query params:

| Method | Query Params | Action |
|--------|-------------|--------|
| GET | (none) | List highlights with search/filter/pagination |
| GET | `?search=term` | Full-text search across text, pageTitle, notes, domain |
| GET | `?tagIds=1,2` | Filter by tag IDs |
| GET | `?metadataTag=AI,Business` | Filter by auto-inferred tags |
| GET | `?domain=chatgpt.com` | Filter by source domain |
| GET | `?action=trash` | List soft-deleted highlights |
| GET | `?action=metadata-tags` | List all unique metadata tags |
| GET | `?action=stats` | Domain-grouped highlight counts |
| GET | `?action=export&format=json` | Export all highlights as JSON |
| GET | `?action=export&format=markdown` | Export all highlights as Markdown |
| GET | `?id=123` | Get single highlight by ID |
| POST | (body) | Create new highlight |
| PATCH | `?id=123` | Update notes, text, or tagIds |
| PATCH | `?id=123&action=restore` | Restore from trash (must be BEFORE generic PATCH) |
| DELETE | `?id=123` | Soft delete (move to trash) |
| DELETE | `?id=123&action=purge` | Hard delete (permanent) |

All queries (except trash) filter by `isNull(highlights.deletedAt)`.

---

## 13. File Structure Overview

```
mindpalace_advanced/
├── api/                          # Vercel serverless functions (12 max)
│   ├── auth/                     # login, logout, me, register, reset-password
│   ├── chat/                     # AI chat endpoint (Gemini)
│   ├── extension/                # Chrome extension API (merged GET+POST)
│   ├── highlights/               # Main CRUD for highlights
│   ├── tags/                     # Tag management
│   └── tokens/                   # API token management
├── drizzle/                      # SQL migration files
├── docs/superpowers/plans/       # Implementation plans
├── extension/                    # Chrome extension source
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html / popup.js
│   └── mind-palace-v1.1.1.zip.zip
├── public/                       # Static assets
├── scripts/                      # Utility scripts
├── src/
│   ├── App.tsx                   # Router
│   ├── index.css                 # Tailwind config, themes, custom styles
│   ├── components/ui/            # shadcn/ui components
│   ├── contexts/ThemeContext.tsx  # Dark/light theme provider
│   ├── lib/                      # Shared utilities
│   │   ├── auth.ts               # JWT auth for API routes
│   │   ├── cors.ts               # CORS handler
│   │   ├── db.ts                 # Drizzle + Neon connection
│   │   ├── keyword-tags.ts       # Auto-tag inference
│   │   ├── rate-limit.ts         # In-memory rate limiter
│   │   └── vertex.ts             # Vertex AI auth + callGemini()
│   ├── pages/                    # Page components
│   │   ├── Home.tsx              # Landing page
│   │   ├── MindPalace.tsx        # Main dashboard (~1300 lines)
│   │   ├── Login.tsx / Register.tsx / ForgotPassword.tsx
│   │   ├── Settings.tsx
│   │   └── FAQ.tsx / Privacy.tsx / Contact.tsx
│   └── schema.ts                 # Drizzle ORM table definitions
├── package.json
├── vercel.json
├── vite.config.ts
└── tsconfig*.json
```

---

## 14. Development Workflow

1. **Worktree**: Development happens in `.worktrees/v2-updates` (branch: `v2-updates`)
2. **Build**: `npm run build` (tsc + vite)
3. **Deploy**: Merge `v2-updates` into `main`, push to origin → Vercel auto-deploys
4. **Function count check**: `find api -name "*.ts" | wc -l` (must be ≤ 12)
5. **Vercel env vars**: Added via Vercel dashboard (Settings → Environment Variables)

---

## 15. Known Constraints & Gotchas

- **12 function limit**: Every `.ts` file in `api/` counts. Merge endpoints or remove unused ones before adding new API routes.
- **Professor's deployment**: Never push changes to the original Vercel project.
- **DB schema drift**: If columns are added in `schema.ts`, the actual database must be updated via ALTER TABLE (manually or via migration scripts). Drizzle doesn't auto-migrate.
- **Extension auth**: Uses API tokens, not cookies. Tokens are managed in Settings → API Tokens.
- **`jose` v4**: Pinned to v4 for CJS compatibility with Vercel serverless functions.
- **CSS `@import` order warning**: Pre-existing Tailwind warning during builds — harmless, can be ignored.
- **PATCH handler ordering**: In `api/highlights/index.ts`, the `PATCH+action=restore` handler MUST come before the generic `PATCH` handler or restore will never execute.
- **Vercel env var corruption**: Vercel DESTROYS JSON env vars containing `\n` escape sequences (like GCP service account PEM keys). It converts `\n` to real newlines, corrupts some to `\` + space, and double-escapes others. **Solution**: Base64-encode the entire JSON before storing as env var. The code does `Buffer.from(raw, "base64").toString("utf8")` before `JSON.parse()`. Never store raw JSON with `\n` escapes in Vercel env vars.
- **Vertex AI model locations**: Gemini 3.x models require `global` location, NOT regional locations like `us-central1`. The API URL format changes: `https://aiplatform.googleapis.com/v1/...` (no region prefix) instead of `https://us-central1-aiplatform.googleapis.com/v1/...`.
- **Deploy workflow**: Always merge `v2-updates` → `main` and push both. Vercel auto-deploys from `main`. Just pushing `v2-updates` alone creates only a preview deployment, not production.
- **User credentials**: Username `aupadhyay`, email `aupadhyay@mba2027.hbs.edu`. Login endpoint uses `username` field (not `email`) in the POST body, but accepts either username or email as the value.
