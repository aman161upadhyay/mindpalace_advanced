# Highlight Compendium — End-to-End Documentation

This document serves as the master reference file for the **Highlight Compendium** project. It outlines the holistic approach taken, details the issues resolved during the final development push, provides a comprehensive manifest of every file in the codebase, and offers actionable considerations for future development.

---

## 1. Project Overview & Approach

### Architecture
The project is split into three tightly integrated layers:
1. **The Chrome Extension (MV3)**: A lightweight, intuitive tool that allows users to instantly capture highlighted text across the web. It uses a modern Floating Action Button (FAB) and keyboard shortcuts.
2. **The Serverless Backend (Vercel + Node.js)**: A collection of serverless API endpoints that handle authentication, extension webhooks, and CRUD operations.
3. **The Database (Neon Postgres + Drizzle ORM)**: A highly scalable, serverless relational database.
4. **The Web Dashboard (React + Vite)**: A beautiful, dynamic "compendium" interface to search, filter, and manage saved highlights.

### Development Approach
The primary goal was to create a frictionless user experience. We focused heavily on **resilience** (e.g., fallback mechanisms for shortcuts, robust database connection pooling) and **developer experience** (using Vercel's zero-config deployment and Drizzle's strict type safety). The UI was built with a rich, dynamic aesthetic featuring dark mode support and micro-animations.

---

## 2. Critical Issues Solved

During the final deployment and debugging phases, several critical systemic issues were resolved:

1. **Extension Caching & Ghost Files**
   - *Issue*: Chrome was silently loading stale extension files (dated April 15th) from the project's root directory instead of the updated `extension/` subfolder, causing missing features and errors.
   - *Solution*: Deleted the duplicate root files (`content.js`, `background.js`, `manifest.json`) and forced a clean reload of the `extension/` directory.

2. **Hardcoded API Token Sync Loop**
   - *Issue*: The extension was trapped in a sync loop where `background.js` would unconditionally overwrite the user's valid API token with an old, hardcoded fallback token every time the service worker woke up. This caused persistent HTTP 401 Unauthorized errors.
   - *Solution*: Completely rewrote `background.js` to dynamically fetch settings from `chrome.storage.sync` via Promises, ensuring user-defined tokens are always respected.

3. **Vercel API Routing Bugs (404 Errors)**
   - *Issue*: A complex negative lookahead regex in `vercel.json` was accidentally intercepting `/api/*` routes, resulting in immediate 404s when the extension tried to communicate with the backend.
   - *Solution*: Replaced the rewrite rule with a standard SPA fallback (`{ "source": "/(.*)", "destination": "/index.html" }`) while allowing Vercel's automatic API routing to handle the `/api/` endpoints.

4. **Keyboard Shortcut Conflicts**
   - *Issue*: Complex SPAs (like Gemini or Wikipedia) often block or intercept the default `Ctrl+Shift+S` shortcut.
   - *Solution*: Engineered a modern **Floating Action Button (FAB)** in the content script that automatically pops up precisely at the user's cursor upon text selection.

---

## 3. Directory Structure & Complete File Manifest

### Root Configuration & Meta Files
- **`package.json` / `package-lock.json`**: Dependencies and build scripts for the React application and API environment.
- **`vercel.json`**: Production configuration for Vercel, dictating SPA routing and CORS headers.
- **`vite.config.ts`**: Vite configuration for the React frontend build.
- **`drizzle.config.ts` / `drizzle/*`**: Drizzle ORM configuration and auto-generated SQL migrations.
- **`tsconfig.*.json`**: TypeScript rules segmented for Node (`api`), React (`app`), and Vite config.
- **`eslint.config.js`**: Standardized linting rules.
- **`IMPLEMENTATION_PLAN.md`, `HANDOFF.md`, `README.md`, `todo.md`**: Legacy tracking and specification files from various project phases.

### Vercel Serverless APIs (`api/`)
- **`api/auth/*`** (`login.ts`, `logout.ts`, `me.ts`, `register.ts`): JWT/Cookie-based authentication layer.
- **`api/extension/save.ts`**: The primary webhook for the Chrome extension. Extracts metadata, creates an entry, and invokes auto-tagging.
- **`api/extension/recent.ts`**: Lightweight endpoint serving the 5 most recent highlights for the extension's popup preview.
- **`api/highlights/*` & `api/tags/*`**: Standard REST endpoints powering the React dashboard.
- **`api/tokens/*`**: Endpoints allowing users to generate and revoke API tokens.

### React Dashboard Application (`src/`)
#### Core Utility Layer (`src/lib/` & `src/schema.ts`)
- **`src/schema.ts`**: The single source of truth for the database schema (Users, Highlights, Tags, Tokens).
- **`src/lib/db.ts`**: Initialization of the Neon serverless PostgreSQL connection.
- **`src/lib/auth.ts`**: Password hashing (Bcrypt) and secure session validation logic.
- **`src/lib/cors.ts`**: Middleware ensuring the extension can safely POST data from any domain.
- **`src/lib/keyword-tags.ts`**: A naive text-analysis utility that generates relevant tags from saved highlights.

#### Contexts & Hooks (`src/contexts/` & `src/_core/`)
- **`src/contexts/AuthContext.tsx` & `src/_core/hooks/useAuth.ts`**: Global state provider managing user sessions and UI loading states.
- **`src/contexts/ThemeContext.tsx`**: Manages the beautiful light/dark UI themes.

#### Pages (`src/pages/`)
- **`Home.tsx`**: Landing page explaining the value proposition.
- **`Compendium.tsx`**: The core application view. Renders the masonry layout of saved highlights, complete with filtering and search capabilities.
- **`Settings.tsx`**: Token management and the "Web-to-Extension Bridge" that allows users to seamlessly push their API token to the Chrome extension without opening it.
- **`Login.tsx` / `Register.tsx`**: Clean, accessible authentication forms.

#### UI Components (`src/components/ui/`)
- Contains highly reusable, beautifully styled components heavily inspired by Shadcn UI: `badge.tsx`, `button.tsx`, `dialog.tsx`, `input.tsx`, `skeleton.tsx`, `sonner.tsx`, `textarea.tsx`, `tooltip.tsx`.

### Chrome Extension (`extension/`)
- **`extension/manifest.json`**: The MV3 blueprint defining permissions (`storage`, `contextMenus`, `scripting`) and registering background/content scripts.
- **`extension/background.js`**: The service worker. Orchestrates cross-origin API calls (`fetch`), keyboard shortcut relays, and context menu clicks. Crucially, it manages the persistent API token state.
- **`extension/content.js`**: Injected directly into host websites. It safely parses the DOM selection, captures metadata (Domain, URL, Title), and renders the Shadow DOM Floating Action Button overlay to prevent CSS leakage.
- **`extension/popup.html` & `extension/popup.js`**: The visual UI that appears when clicking the puzzle-piece extension icon. Provides a settings pane and a quick view of recent saves.
- **`extension/icons/*`**: Standard branding assets required by Chrome.

---

## 4. Future Development Considerations

When handing off or continuing development, consider the following technical priorities:

1. **Intelligent Auto-Tagging (AI Integration)**
   - *Current State*: `keyword-tags.ts` relies on simple string matching and regex arrays.
   - *Future*: Integrate a lightweight LLM call (e.g., OpenAI or Gemini API) directly inside `api/extension/save.ts` to assign highly semantic, contextual tags automatically.

2. **Rich Text & Media Capture**
   - *Current State*: The content script captures `.toString()` plain text.
   - *Future*: Capture raw HTML or convert DOM selections to Markdown. This preserves hyperlinks, bold styling, and inline images. Ensure you implement heavy HTML sanitization (e.g., `DOMPurify`) before storing/rendering to prevent XSS.

3. **Data Pagination & Virtualization**
   - *Current State*: `Compendium.tsx` fetches and renders all highlights simultaneously.
   - *Future*: As user compendiums grow into thousands of items, transition the `api/highlights` endpoint to cursor-based pagination and implement a virtualization library (like `react-virtualized`) on the frontend to maintain 60FPS scrolling.

4. **Advanced Extension Fallbacks**
   - *Current State*: The FAB works excellently, but complex sites (like Google Docs or Notion) use `<canvas>` or highly custom DOM structures that bypass standard `window.getSelection()`.
   - *Future*: Implement site-specific adapters inside `content.js` to extract text from proprietary editor structures.

5. **Data Deduplication Mechanism**
   - *Current State*: A user can highlight the same phrase twice, creating two identical database rows.
   - *Future*: Implement a hashing mechanism in the database or backend to silently reject or merge mathematically identical highlights from the same URL.
