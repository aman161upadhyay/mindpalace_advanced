# Mind Palace v2 Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a separate Mind Palace v2 Vercel app backed by a separate Neon Postgres database, and produce a Chrome extension named `mind palace v2` / `V2MindPalace V2.1` that points to the new deployment without hardcoded secrets.

**Architecture:** Keep the dashboard/API product name as Mind Palace while isolating v2 infrastructure at the Vercel project and database layer. Runtime secrets live in Vercel env vars and local `.env.local`; extension user configuration lives in `chrome.storage.sync`, not source code.

**Tech Stack:** Vite + React, Vercel serverless functions, Neon Postgres, Drizzle ORM schema definitions, Chrome Extension MV3.

---

## Task 1: Preflight

**Files:**
- Read: `package.json`
- Read: `vercel.json`
- Read: `.env.local.example`
- Read: `extension/manifest.json`
- Read: `extension/background.js`
- Read: `extension/popup.js`

- [ ] Verify git status and note user-provided changed files.
- [ ] Install or invoke Vercel CLI.
- [ ] Verify Vercel authentication.
- [ ] Verify required env keys: `DATABASE_URL`, `JWT_SECRET`.
- [ ] Confirm no real secret values are committed.

## Task 2: Extension v2 Branding And Configuration

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/background.js`
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`
- Modify: `extension/content.js` if user-facing copy still says Mind Palace incorrectly

- [ ] Rename Chrome extension to `mind palace v2`.
- [ ] Set extension version to `2.1.0`.
- [ ] Remove hardcoded API token from source.
- [ ] Remove old hardcoded dashboard URL from source.
- [ ] Make popup/settings require a user-configured dashboard URL and API token.
- [ ] Keep user settings in `chrome.storage.sync`.

## Task 3: Separate Vercel Project And Env

**Files:**
- Modify/create: `.vercel/project.json` through Vercel CLI linking
- Write local-only: `.env.local`

- [ ] Create or link new Vercel project `mind-palace-v2`.
- [ ] Create/provision separate Neon Postgres database for v2.
- [ ] Add `DATABASE_URL` to Vercel for production, preview, and development.
- [ ] Generate a strong `JWT_SECRET` without printing it.
- [ ] Add `JWT_SECRET` to Vercel for production, preview, and development.
- [ ] Pull env vars into `.env.local`.

## Task 4: Database Setup

**Files:**
- Read: `src/schema.ts`
- Use: project database setup command or Drizzle Kit

- [ ] Ensure schema can be pushed to the new Neon database.
- [ ] Run the schema setup against v2 database only.
- [ ] Verify auth/tokens/highlights tables exist through application behavior or a safe DB check.

## Task 5: Build And Deploy

**Files:**
- Read: build output

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Deploy to Vercel production.
- [ ] Capture deployment URL.
- [ ] Update extension default guidance/docs with the new URL, but do not hardcode secrets.

## Task 6: Package Extension

**Files:**
- Source: `extension/`
- Create: `dist-extension/mind-palace-v2.1.zip`

- [ ] Package the MV3 extension folder into a zip.
- [ ] Confirm manifest name and version inside the package.
- [ ] Provide Chrome loading instructions for the packed/unpacked extension.

