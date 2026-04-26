# Mind Palace Full Build -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Mind Palace from a local demo into a production-ready public product on Vercel with real auth, Neon Postgres, and a self-configuring Chrome/Edge extension.

**Architecture:** Vercel Serverless Functions handle all API calls; React + Vite frontend deploys as static site on Vercel CDN; Neon Postgres stores all data via Drizzle ORM; JWT in httpOnly cookies authenticates dashboard users; API tokens authenticate the browser extension.

**Tech Stack:** React 18, TypeScript, Vite, Drizzle ORM, Neon Postgres, `jose` (JWT), `bcryptjs`, `nanoid`, Vercel Serverless Functions, Chrome Extension Manifest V3

---

## Task 1: Install dependencies, delete old files, add config

**Goal:** Clean out the old local-only stack (Express, tRPC, mysql2) and install the new production packages. Add Vercel and environment config.

- [ ] **1.1** Install new production dependencies:
```bash
npm install bcryptjs jose @neondatabase/serverless
npm install -D @types/bcryptjs
```

- [ ] **1.2** Remove packages that are no longer needed:
```bash
npm uninstall @trpc/client @trpc/react-query @trpc/server express cors mysql2 @tanstack/react-query
```

Note: `nanoid` and `drizzle-orm` are already installed and stay. `zod` stays (used for validation in API routes).

- [ ] **1.3** Delete old files:
```bash
rm server.cjs
rm src/lib/trpc.ts
rm src/routers.ts
rm src/db.ts
```

- [ ] **1.4** Create `vercel.json` at project root with this exact content:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **1.5** Create `.env.local.example` at project root:
```
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=replace_with_random_64_char_string
```

- [ ] **1.6** Update `.gitignore` -- append these lines at the end:
```
# Environment
.env.local

# Superpowers
.superpowers/
```

- [ ] **1.7** Update `vite.config.ts` to add a dev proxy so `fetch('/api/...')` calls from the Vite dev server forward to `vercel dev` on port 3000:

**File: `vite.config.ts`** (complete replacement)
```ts
import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **1.8** Add a `tsconfig.api.json` for the Vercel serverless functions so TypeScript resolves the `/api` folder. This file is consumed by Vercel's build step automatically when it detects TS files in `/api`:

**File: `tsconfig.api.json`**
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist-api",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["api/**/*.ts", "src/lib/**/*.ts", "src/schema.ts"]
}
```

- [ ] **1.9** Commit: "chore: remove tRPC/Express stack, add Vercel + Neon deps"

---

## Task 2: New database schema and client

**Goal:** Rewrite `src/schema.ts` for Postgres via `drizzle-orm/pg-core` and create a new `src/lib/db.ts` that connects to Neon via the HTTP adapter.

- [ ] **2.1** Rewrite `src/schema.ts` -- complete replacement:

**File: `src/schema.ts`**
```ts
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  theme: varchar("theme", { length: 10 }).notNull().default("dark"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── API Tokens ─────────────────────────────────────────────────────────────

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiToken = typeof apiTokens.$inferSelect;
export type InsertApiToken = typeof apiTokens.$inferInsert;

// ─── Tags ───────────────────────────────────────────────────────────────────

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ─── Highlights ─────────────────────────────────────────────────────────────

export const highlights = pgTable("highlights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  sourceUrl: text("source_url").notNull(),
  pageTitle: varchar("page_title", { length: 512 }).notNull().default(""),
  domain: varchar("domain", { length: 255 }).notNull().default(""),
  notes: text("notes"),
  tagIds: varchar("tag_ids", { length: 1024 }).notNull().default("[]"),
  metadataTags: varchar("metadata_tags", { length: 1024 }).notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Highlight = typeof highlights.$inferSelect;
export type InsertHighlight = typeof highlights.$inferInsert;
```

- [ ] **2.2** Create `src/lib/db.ts`:

**File: `src/lib/db.ts`**
```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../schema";

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

const sql = neon(getDbUrl());
export const db = drizzle(sql, { schema });
```

- [ ] **2.3** Create the SQL migration file for reference. Create `drizzle/0001_init.sql`:

**File: `drizzle/0001_init.sql`**
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  theme VARCHAR(10) NOT NULL DEFAULT 'dark',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  label VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(64) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS highlights (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  page_title VARCHAR(512) NOT NULL DEFAULT '',
  domain VARCHAR(255) NOT NULL DEFAULT '',
  notes TEXT,
  tag_ids VARCHAR(1024) NOT NULL DEFAULT '[]',
  metadata_tags VARCHAR(1024) NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_domain ON highlights(domain);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
```

- [ ] **2.4** Commit: "feat: add Postgres schema and Neon db client"

---

## Task 3: Auth helpers

**Goal:** Create JWT sign/verify functions using `jose` and a `requireAuth` helper that reads the `mp_session` httpOnly cookie.

- [ ] **3.1** Create `src/lib/auth.ts`:

**File: `src/lib/auth.ts`**
```ts
import { SignJWT, jwtVerify } from "jose";

interface JwtPayload {
  userId: number;
  username: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId === "number" &&
      typeof payload.username === "string"
    ) {
      return { userId: payload.userId, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export async function requireAuth(
  req: Request
): Promise<JwtPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];

  if (!token) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    throw new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return payload;
}

export function setSessionCookie(token: string): string {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `mp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `mp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
```

- [ ] **3.2** Commit: "feat: add JWT auth helpers with jose"

---

## Task 4: Keyword tagger

**Goal:** Replace the old Ollama-based auto-tagger with a simple keyword-matching function that works in serverless environments.

- [ ] **4.1** Create `src/lib/keyword-tags.ts`:

**File: `src/lib/keyword-tags.ts`**
```ts
const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  AI: /\b(ai|artificial intelligence|machine learning|neural|llm|gpt|transformer|deep learning|model training|nlp|chatbot|agent|diffusion)\b/i,
  Security: /\b(security|crypto|hack|vulnerability|encrypt|auth|firewall|malware|phishing|zero.day|exploit|penetration|cybersec)\b/i,
  Design: /\b(design|ux|ui|user experience|user interface|figma|typography|layout|aesthetic|wireframe|prototype|visual)\b/i,
  Engineering: /\b(code|programming|dev|software|engineer|api|function|component|algorithm|database|backend|frontend|deploy|git|docker|kubernetes|microservice|react|typescript|javascript|python|rust|golang)\b/i,
  Business: /\b(business|startup|finance|revenue|market|strategy|growth|invest|valuation|profit|saas|enterprise|founder|venture|capital|ipo)\b/i,
  Science: /\b(science|research|study|experiment|hypothesis|biology|physics|chemistry|neuroscience|genetics|quantum|data.?set|peer.?review|journal|clinical)\b/i,
  Writing: /\b(writ|essay|article|blog|narrative|storytelling|prose|draft|edit|publish|author|journal|memoir|rhetoric)\b/i,
  Health: /\b(health|fitness|medicine|exercise|nutrition|wellness|mental health|therapy|diet|sleep|cardio|clinical|patient|diagnosis)\b/i,
};

export function inferTags(text: string): string[] {
  const matched: string[] = [];

  for (const [category, regex] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regex.test(text)) {
      matched.push(category);
    }
    if (matched.length >= 3) break;
  }

  return matched;
}
```

- [ ] **4.2** Commit: "feat: add keyword-based auto-tagger"

---

## Task 5: API -- Auth routes

**Goal:** Create the four auth-related Vercel serverless function files.

Every handler in `/api/` is a standard Vercel serverless function: it exports a default function that receives `(req: Request) => Response | Promise<Response>`. These use the Web Standard Request/Response API (Vercel Edge-compatible, but we run in Node runtime).

**Important:** Vercel serverless functions in the `/api` folder using the Web Standard API should use `export const runtime = "edge"` or default Node runtime. We will use the default Node runtime with the Web Fetch API style. Each file exports a default handler.

- [ ] **5.1** Create `api/auth/register.ts`:

**File: `api/auth/register.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie } from "../../src/lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, email, password } = req.body ?? {};

    if (!username || typeof username !== "string" || username.length < 2 || username.length > 64) {
      return res.status(400).json({ error: "Username must be 2-64 characters" });
    }
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existingByUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .limit(1);

    if (existingByUsername.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const existingByEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (existingByEmail.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const inserted = await db
      .insert(users)
      .values({
        username: trimmedUsername,
        email: trimmedEmail,
        passwordHash,
      })
      .returning({ id: users.id, username: users.username, email: users.email, theme: users.theme });

    const user = inserted[0];

    // Create first API token
    const tokenValue = `hc_${nanoid(40)}`;
    await db.insert(apiTokens).values({
      userId: user.id,
      token: tokenValue,
      label: "Chrome Extension",
    });

    // Sign JWT
    const jwt = await signJwt({ userId: user.id, username: user.username });

    res.setHeader("Set-Cookie", setSessionCookie(jwt));
    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email, theme: user.theme },
      apiToken: tokenValue,
    });
  } catch (err: unknown) {
    console.error("[register] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **5.2** Create `api/auth/login.ts`:

**File: `api/auth/login.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq, or } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie } from "../../src/lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body ?? {};

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username or email is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    const trimmedLogin = username.trim().toLowerCase();

    // Find user by username or email
    const found = await db
      .select()
      .from(users)
      .where(or(eq(users.username, trimmedLogin), eq(users.email, trimmedLogin)))
      .limit(1);

    if (found.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = found[0];

    // Compare password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Ensure user has at least one API token
    const existingTokens = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .limit(1);

    let apiToken: string | null = null;
    if (existingTokens.length === 0) {
      const tokenValue = `hc_${nanoid(40)}`;
      await db.insert(apiTokens).values({
        userId: user.id,
        token: tokenValue,
        label: "Chrome Extension",
      });
      apiToken = tokenValue;
    } else {
      apiToken = existingTokens[0].token;
    }

    // Sign JWT
    const jwt = await signJwt({ userId: user.id, username: user.username });

    res.setHeader("Set-Cookie", setSessionCookie(jwt));
    return res.status(200).json({
      user: { id: user.id, username: user.username, email: user.email, theme: user.theme },
      apiToken,
    });
  } catch (err: unknown) {
    console.error("[login] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **5.3** Create `api/auth/logout.ts`:

**File: `api/auth/logout.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie } from "../../src/lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ success: true });
}
```

- [ ] **5.4** Create `api/auth/me.ts`:

**File: `api/auth/me.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users } from "../../src/schema";
import { verifyJwt, setSessionCookie, signJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse JWT from cookie
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  if (req.method === "GET") {
    const found = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        theme: users.theme,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (found.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.status(200).json(found[0]);
  }

  if (req.method === "PATCH") {
    const { theme } = req.body ?? {};

    if (theme !== undefined) {
      if (theme !== "dark" && theme !== "light") {
        return res.status(400).json({ error: "Theme must be 'dark' or 'light'" });
      }

      await db
        .update(users)
        .set({ theme, updatedAt: new Date() })
        .where(eq(users.id, payload.userId));
    }

    const found = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        theme: users.theme,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    return res.status(200).json(found[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **5.5** Verify auth routes work:
```bash
# Start vercel dev, then test:
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}' \
  -c cookies.txt -v
# Expected: 201 with { user: {...}, apiToken: "hc_..." } and Set-Cookie header

# Me
curl http://localhost:3000/api/auth/me -b cookies.txt
# Expected: 200 with { id, username, email, theme }

# Logout
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt -c cookies.txt
# Expected: 200 with { success: true } and cleared cookie
```

- [ ] **5.6** Commit: "feat: add auth API routes (register, login, logout, me)"

---

## Task 6: API -- Highlights routes

**Goal:** Create all highlights CRUD and utility endpoints.

- [ ] **6.1** Create `api/highlights/index.ts`:

**File: `api/highlights/index.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";
import { inferTags } from "../../src/lib/keyword-tags";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

async function getAuthUserId(req: VercelRequest): Promise<number | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const search = (req.query.search as string) || "";
    const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;
    const domain = (req.query.domain as string) || "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 30;
    const offset = (page - 1) * limit;

    const conditions = [eq(highlights.userId, userId)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(highlights.text, pattern),
          like(highlights.pageTitle, pattern),
          like(highlights.notes, pattern),
          like(highlights.domain, pattern)
        )!
      );
    }

    if (domain) {
      conditions.push(eq(highlights.domain, domain));
    }

    if (tagId) {
      conditions.push(
        or(
          like(highlights.tagIds, `[${tagId}]`),
          like(highlights.tagIds, `[${tagId},%`),
          like(highlights.tagIds, `%,${tagId}]`),
          like(highlights.tagIds, `%,${tagId},%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(highlights)
        .where(whereClause)
        .orderBy(desc(highlights.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(highlights)
        .where(whereClause),
    ]);

    return res.status(200).json({
      items,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  }

  if (req.method === "POST") {
    const { text, sourceUrl, pageTitle, domain } = req.body ?? {};

    if (!text || typeof text !== "string" || text.length === 0) {
      return res.status(400).json({ error: "Text is required" });
    }
    if (text.length > 50000) {
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });
    }
    if (!sourceUrl || typeof sourceUrl !== "string") {
      return res.status(400).json({ error: "Source URL is required" });
    }

    const metadataTags = inferTags(text);

    const inserted = await db
      .insert(highlights)
      .values({
        userId,
        text,
        sourceUrl,
        pageTitle: (pageTitle as string) || "",
        domain: (domain as string) || "",
        notes: null,
        tagIds: "[]",
        metadataTags: JSON.stringify(metadataTags),
      })
      .returning();

    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **6.2** Create `api/highlights/[id].ts`:

**File: `api/highlights/[id].ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

async function getAuthUserId(req: VercelRequest): Promise<number | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = Number(req.query.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid highlight ID" });
  }

  if (req.method === "PATCH") {
    const { notes, tagIds } = req.body ?? {};

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    if (tagIds !== undefined) {
      if (!Array.isArray(tagIds)) {
        return res.status(400).json({ error: "tagIds must be an array" });
      }
      updateData.tagIds = JSON.stringify(tagIds);
    }

    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Highlight not found" });
    }

    await db
      .update(highlights)
      .set(updateData)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)));

    const updated = await db
      .select()
      .from(highlights)
      .where(eq(highlights.id, id))
      .limit(1);

    return res.status(200).json(updated[0]);
  }

  if (req.method === "DELETE") {
    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Highlight not found" });
    }

    await db
      .delete(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)));

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **6.3** Create `api/highlights/domain-stats.ts`:

**File: `api/highlights/domain-stats.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const stats = await db
    .select({
      domain: highlights.domain,
      count: sql<number>`count(*)`,
    })
    .from(highlights)
    .where(eq(highlights.userId, payload.userId))
    .groupBy(highlights.domain)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  return res.status(200).json(stats);
}
```

- [ ] **6.4** Create `api/highlights/export.ts`:

**File: `api/highlights/export.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "markdown") {
    return res.status(400).json({ error: "Format must be 'json' or 'markdown'" });
  }

  const allHighlights = await db
    .select()
    .from(highlights)
    .where(eq(highlights.userId, payload.userId))
    .orderBy(desc(highlights.createdAt));

  const allTags = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, payload.userId));

  const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

  if (format === "json") {
    const data = allHighlights.map((h) => ({
      id: h.id,
      text: h.text,
      sourceUrl: h.sourceUrl,
      pageTitle: h.pageTitle,
      domain: h.domain,
      notes: h.notes,
      tags: (JSON.parse(h.tagIds || "[]") as number[])
        .map((id) => tagMap[id]?.name)
        .filter(Boolean),
      metadataTags: JSON.parse(h.metadataTags || "[]"),
      createdAt: h.createdAt,
    }));
    return res
      .status(200)
      .json({ content: JSON.stringify(data, null, 2), filename: "highlights.json" });
  }

  // Markdown export
  const grouped: Record<string, typeof allHighlights> = {};
  for (const h of allHighlights) {
    const key = h.domain || "Unknown Source";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  }

  let md = `# My Mind Palace\n\n*Exported ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  for (const [domain, items] of Object.entries(grouped)) {
    md += `## ${domain}\n\n`;
    for (const h of items) {
      const tagNames = (JSON.parse(h.tagIds || "[]") as number[])
        .map((id) => tagMap[id]?.name)
        .filter(Boolean);
      md += `> ${h.text}\n\n`;
      md += `**Source:** [${h.pageTitle || h.sourceUrl}](${h.sourceUrl})  \n`;
      md += `**Saved:** ${new Date(h.createdAt).toLocaleDateString()}  \n`;
      if (tagNames.length) md += `**Tags:** ${tagNames.join(", ")}  \n`;
      if (h.notes) md += `**Notes:** ${h.notes}  \n`;
      md += `\n---\n\n`;
    }
  }
  return res
    .status(200)
    .json({ content: md, filename: "highlights.md" });
}
```

- [ ] **6.5** Commit: "feat: add highlights API routes (list, create, update, delete, export, domain-stats)"

---

## Task 7: API -- Tags, Tokens, Extension routes

**Goal:** Create the remaining API routes for tags, tokens, and the extension-specific endpoints.

- [ ] **7.1** Create `api/tags/index.ts`:

**File: `api/tags/index.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { tags } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

async function getAuthUserId(req: VercelRequest): Promise<number | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);

    return res.status(200).json(userTags);
  }

  if (req.method === "POST") {
    const { name, color } = req.body ?? {};

    if (!name || typeof name !== "string" || name.length === 0 || name.length > 64) {
      return res.status(400).json({ error: "Tag name must be 1-64 characters" });
    }

    const tagColor = color || "#6366f1";
    if (!/^#[0-9a-fA-F]{6}$/.test(tagColor)) {
      return res.status(400).json({ error: "Color must be a valid hex color (e.g. #6366f1)" });
    }

    const inserted = await db
      .insert(tags)
      .values({ userId, name, color: tagColor })
      .returning();

    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **7.2** Create `api/tags/[id].ts`:

**File: `api/tags/[id].ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { tags } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid tag ID" });
  }

  await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, payload.userId)));

  return res.status(200).json({ success: true });
}
```

- [ ] **7.3** Create `api/tokens/index.ts`:

**File: `api/tokens/index.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

async function getAuthUserId(req: VercelRequest): Promise<number | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const tokens = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));

    return res.status(200).json(tokens);
  }

  if (req.method === "POST") {
    const { label } = req.body ?? {};
    const tokenLabel = (label as string) || "Chrome Extension";
    const tokenValue = `hc_${nanoid(40)}`;

    const inserted = await db
      .insert(apiTokens)
      .values({ userId, token: tokenValue, label: tokenLabel })
      .returning();

    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **7.4** Create `api/tokens/[id].ts`:

**File: `api/tokens/[id].ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) {
      cookies[k] = decodeURIComponent(rest.join("=").trim());
    }
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid token ID" });
  }

  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, payload.userId)));

  return res.status(200).json({ success: true });
}
```

- [ ] **7.5** Create `api/extension/save.ts`:

**File: `api/extension/save.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights, users } from "../../src/schema";
import { inferTags } from "../../src/lib/keyword-tags";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { apiToken, text, sourceUrl, pageTitle, domain } = req.body ?? {};

    if (!apiToken || typeof apiToken !== "string") {
      return res.status(401).json({ error: "API token is required" });
    }

    // Resolve user from API token
    const tokenRows = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.token, apiToken))
      .limit(1);

    if (tokenRows.length === 0) {
      return res.status(401).json({ error: "Invalid API token" });
    }

    const userId = tokenRows[0].userId;

    if (!text || typeof text !== "string" || text.length === 0) {
      return res.status(400).json({ error: "Text is required" });
    }
    if (text.length > 50000) {
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });
    }

    const metadataTags = inferTags(text);

    const inserted = await db
      .insert(highlights)
      .values({
        userId,
        text,
        sourceUrl: sourceUrl || "",
        pageTitle: (pageTitle as string) || "",
        domain: (domain as string) || "",
        notes: null,
        tagIds: "[]",
        metadataTags: JSON.stringify(metadataTags),
      })
      .returning();

    return res.status(201).json(inserted[0]);
  } catch (err: unknown) {
    console.error("[extension/save] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **7.6** Create `api/extension/recent.ts`:

**File: `api/extension/recent.ts`**
```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiToken = req.query.apiToken as string;

  if (!apiToken) {
    return res.status(401).json({ error: "API token is required" });
  }

  const tokenRows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.token, apiToken))
    .limit(1);

  if (tokenRows.length === 0) {
    return res.status(401).json({ error: "Invalid API token" });
  }

  const userId = tokenRows[0].userId;

  const recent = await db
    .select()
    .from(highlights)
    .where(eq(highlights.userId, userId))
    .orderBy(desc(highlights.createdAt))
    .limit(5);

  return res.status(200).json(recent);
}
```

- [ ] **7.7** Commit: "feat: add tags, tokens, and extension API routes"

---

## Task 8: AuthContext and useAuth hook

**Goal:** Create a React context for authentication state, replace the hardcoded `useAuth` hook, and update `App.tsx` with route protection.

- [ ] **8.1** Create `src/contexts/AuthContext.tsx`:

**File: `src/contexts/AuthContext.tsx`**
```ts
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  theme: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  refetch: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: user !== null,
        refetch: fetchUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **8.2** Update `src/_core/hooks/useAuth.ts` to re-export from AuthContext:

**File: `src/_core/hooks/useAuth.ts`** (complete replacement)
```ts
export { useAuth } from "@/contexts/AuthContext";
```

- [ ] **8.3** Update `src/App.tsx` to wrap with AuthProvider and add login/register routes:

**File: `src/App.tsx`** (complete replacement)
```ts
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import MindPalace from "./pages/MindPalace";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/mind-palace">
        <ProtectedRoute component={MindPalace} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **8.4** Commit: "feat: add AuthContext, useAuth hook, and protected routes"

---

## Task 9: ThemeContext update

**Goal:** Make the theme system work with `data-theme` attributes, read initial theme from user profile, and support dark/light toggle that persists to the database.

- [ ] **9.1** Rewrite `src/contexts/ThemeContext.tsx`:

**File: `src/contexts/ThemeContext.tsx`** (complete replacement)
```ts
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface ThemeContextValue {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sync theme from user profile when it becomes available
  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") {
      setTheme(user.theme);
    }
  }, [user?.theme]);

  // Apply data-theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Also keep the class for backward compat with tailwind dark: variant
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    // Persist to database if logged in
    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Silently fail — local state is already updated
    }

    // Push to extension if present
    if (document.documentElement.getAttribute("data-hc-extension") === "true") {
      document.dispatchEvent(
        new CustomEvent("HC_SAVE_SETTINGS", {
          detail: { theme: newTheme },
        })
      );
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **9.2** Update `src/index.css` -- replace the `:root` and `.dark` blocks with `[data-theme="dark"]` and `[data-theme="light"]` blocks. Also update the `@custom-variant` line. Leave all other CSS (after line 112) unchanged.

Replace lines 6 through 112 of `src/index.css` with:

```css
@custom-variant dark (&:is([data-theme="dark"] *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.65rem;
}

/* ─── Dark Theme (Obsidian + Cream) ─── */
[data-theme="dark"] {
  --background: #0c0b09;
  --foreground: #f5efe6;
  --card: #161410;
  --card-foreground: #f5efe6;
  --popover: #161410;
  --popover-foreground: #f5efe6;
  --primary: #e8d9c0;
  --primary-foreground: #0c0b09;
  --secondary: #1e1b16;
  --secondary-foreground: #d4c4a8;
  --muted: #1e1b16;
  --muted-foreground: rgba(235, 220, 190, 0.38);
  --accent: #e8d9c0;
  --accent-foreground: #0c0b09;
  --destructive: #ef4444;
  --destructive-foreground: #f5efe6;
  --border: rgba(235, 220, 190, 0.12);
  --input: #1e1b16;
  --ring: #e8d9c0;
  --chart-1: #e8d9c0;
  --chart-2: #c9b99a;
  --chart-3: #a89878;
  --chart-4: #8a7a60;
  --chart-5: #6b5c48;
  --sidebar: #100f0c;
  --sidebar-foreground: #f5efe6;
  --sidebar-primary: #e8d9c0;
  --sidebar-primary-foreground: #0c0b09;
  --sidebar-accent: #1e1b16;
  --sidebar-accent-foreground: #f5efe6;
  --sidebar-border: rgba(235, 220, 190, 0.12);
  --sidebar-ring: #e8d9c0;
}

/* ─── Light Theme (Parchment + Warm Brown) ─── */
[data-theme="light"] {
  --background: #faf8f5;
  --foreground: #1a1510;
  --card: #ffffff;
  --card-foreground: #1a1510;
  --popover: #ffffff;
  --popover-foreground: #1a1510;
  --primary: #8a7560;
  --primary-foreground: #faf8f5;
  --secondary: #f0ebe4;
  --secondary-foreground: #5a4a38;
  --muted: #f0ebe4;
  --muted-foreground: #8a7a60;
  --accent: #8a7560;
  --accent-foreground: #faf8f5;
  --destructive: #dc2626;
  --destructive-foreground: #faf8f5;
  --border: rgba(180, 160, 130, 0.2);
  --input: #f0ebe4;
  --ring: #8a7560;
  --chart-1: #8a7560;
  --chart-2: #a89878;
  --chart-3: #b5a080;
  --chart-4: #c9b99a;
  --chart-5: #d4c4a8;
  --sidebar: #f5f2ed;
  --sidebar-foreground: #1a1510;
  --sidebar-primary: #8a7560;
  --sidebar-primary-foreground: #faf8f5;
  --sidebar-accent: #ebe6de;
  --sidebar-accent-foreground: #1a1510;
  --sidebar-border: rgba(180, 160, 130, 0.2);
  --sidebar-ring: #8a7560;
}
```

Also update the `.glass-panel` class (around line 155) to work with both themes:
```css
.glass-panel {
  background: rgba(128, 128, 128, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(128, 128, 128, 0.08);
}
```

- [ ] **9.3** Commit: "feat: dual-theme system with Obsidian+Cream and Parchment+WarmBrown"

---

## Task 10: Login and Register pages

**Goal:** Create the Login and Register page components with the luxury dual-theme design.

- [ ] **10.1** Create `src/pages/Login.tsx`:

**File: `src/pages/Login.tsx`**
```ts
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Highlighter, Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { refetch } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Push token to extension if present
      if (document.documentElement.getAttribute("data-hc-extension") === "true") {
        document.dispatchEvent(
          new CustomEvent("HC_SAVE_SETTINGS", {
            detail: {
              apiToken: data.apiToken,
              dashboardUrl: window.location.origin,
              theme: data.user.theme || "dark",
            },
          })
        );
      }

      await refetch();
      navigate("/mind-palace");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Highlighter className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Mind Palace</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Username or email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="your_username"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-primary hover:underline font-medium"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **10.2** Create `src/pages/Register.tsx`:

**File: `src/pages/Register.tsx`**
```ts
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Highlighter, Loader2 } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const { refetch } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Push token to extension if present
      if (document.documentElement.getAttribute("data-hc-extension") === "true") {
        document.dispatchEvent(
          new CustomEvent("HC_SAVE_SETTINGS", {
            detail: {
              apiToken: data.apiToken,
              dashboardUrl: window.location.origin,
              theme: "dark",
            },
          })
        );
      }

      await refetch();
      navigate("/mind-palace");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Highlighter className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Mind Palace</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="your_username"
              required
              autoComplete="username"
              minLength={2}
              maxLength={64}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **10.3** Commit: "feat: add Login and Register pages"

---

## Task 11: Settings page update

**Goal:** Remove all tRPC references from Settings, use plain fetch calls, add theme toggle.

- [ ] **11.1** Rewrite `src/pages/Settings.tsx` -- replace all `trpc.xxx` calls with fetch-based state management. The key changes:

1. Remove `import { trpc } from "@/lib/trpc"` -- replaced with fetch calls
2. Remove `import { getLoginUrl } from "@/const"` -- use `/login` directly
3. Replace `trpc.tokens.list.useQuery()` with `useEffect + fetch('/api/tokens')`
4. Replace `trpc.tokens.create.useMutation()` with `fetch('/api/tokens', { method: 'POST' })`
5. Remove `trpc.useUtils()` calls
6. Add theme toggle section using `useTheme()` from ThemeContext
7. Change `user?.name` references to `user?.username`
8. Add a logout button

**File: `src/pages/Settings.tsx`** (complete replacement)
```ts
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Check,
  Copy,
  Highlighter,
  Key,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Send,
  Sun,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Extension ID Detection ──────────────────────────────────────────────────

function useExtensionBridge() {
  const [connected, setConnected] = useState(false);
  const [extSettings, setExtSettings] = useState({ apiToken: "", dashboardUrl: "" });
  const [checking, setChecking] = useState(true);

  const checkExtension = () => {
    setChecking(true);
    const marker = document.documentElement.getAttribute("data-hc-extension");
    if (!marker) {
      setConnected(false);
      setChecking(false);
      return;
    }

    const timeout = setTimeout(() => {
      setConnected(true);
      setChecking(false);
    }, 1200);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      clearTimeout(timeout);
      setConnected(true);
      setExtSettings({
        apiToken: detail.apiToken || "",
        dashboardUrl: detail.dashboardUrl || "",
      });
      setChecking(false);
      document.removeEventListener("HC_SETTINGS_RESPONSE", handler);
    };

    document.addEventListener("HC_SETTINGS_RESPONSE", handler);
    document.dispatchEvent(new CustomEvent("HC_GET_SETTINGS"));
  };

  useEffect(() => {
    checkExtension();
  }, []);

  const pushSettings = (apiToken: string, dashboardUrl: string) => {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1200);
      const handler = (e: Event) => {
        clearTimeout(timeout);
        setExtSettings({ apiToken, dashboardUrl });
        document.removeEventListener("HC_SETTINGS_SAVED", handler);
        resolve(true);
      };
      document.addEventListener("HC_SETTINGS_SAVED", handler);
      document.dispatchEvent(
        new CustomEvent("HC_SAVE_SETTINGS", {
          detail: { apiToken, dashboardUrl },
        })
      );
    });
  };

  return { connected, extSettings, checking, pushSettings, recheckExtension: checkExtension };
}

// ─── Token management hooks ──────────────────────────────────────────────────

function useTokens() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const createToken = async (label: string) => {
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      await fetchTokens();
      toast.success("API token created");
    } else {
      toast.error("Failed to create token");
    }
  };

  const deleteToken = async (id: number) => {
    const res = await fetch(`/api/tokens/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      await fetchTokens();
      toast.success("Token deleted");
    }
  };

  return { tokens, loading, createToken, deleteToken, refetch: fetchTokens };
}

export default function Settings() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, navigate] = useLocation();
  const { tokens, loading: tokensLoading, createToken, deleteToken } = useTokens();
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyToken = (token: string, id: number) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    toast.success("Token copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateToken = async () => {
    setCreating(true);
    await createToken("Chrome Extension");
    setCreating(false);
  };

  const dashboardUrl = window.location.origin;

  // Extension bridge
  const { connected, extSettings, checking, pushSettings, recheckExtension } =
    useExtensionBridge();
  const [extToken, setExtToken] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (extSettings.apiToken) setExtToken(extSettings.apiToken);
    if (extSettings.dashboardUrl) setExtUrl(extSettings.dashboardUrl);
  }, [extSettings]);

  useEffect(() => {
    if (connected && !extUrl) {
      setExtUrl(dashboardUrl);
    }
  }, [connected, dashboardUrl, extUrl]);

  const handlePushSettings = async () => {
    if (!extToken.trim()) {
      toast.error("Please enter an API token");
      return;
    }
    setPushing(true);
    const ok = await pushSettings(extToken, extUrl || dashboardUrl);
    setPushing(false);
    if (ok) {
      toast.success("Extension configured successfully!");
    } else {
      toast.error(
        "Could not reach the extension. Make sure it's installed and refresh the page."
      );
    }
  };

  const handleQuickConfigure = async (token: string) => {
    setExtToken(token);
    setExtUrl(dashboardUrl);
    setPushing(true);
    const ok = await pushSettings(token, dashboardUrl);
    setPushing(false);
    if (ok) {
      toast.success("Extension auto-configured! You're all set.");
    } else {
      toast.error("Extension not detected. Install it and refresh this page.");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Highlighter className="w-10 h-10 text-primary" />
        <h2 className="text-xl font-semibold">Sign in to access settings</h2>
        <Button onClick={() => navigate("/login")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/mind-palace")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Settings</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        {/* Account */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {user?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1">
                <p className="font-medium">{user?.username ?? "User"}</p>
                <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign out
              </Button>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Theme</h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-primary" />
                )}
                <div>
                  <p className="font-medium">
                    {theme === "dark" ? "Dark" : "Light"} theme
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {theme === "dark" ? "Obsidian + Cream" : "Parchment + Warm Brown"}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="relative w-12 h-7 rounded-full bg-secondary border border-border transition-colors"
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-primary transition-transform ${
                    theme === "light" ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* API Tokens */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">API Tokens</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Use these tokens to authenticate the Chrome extension with your account.
              </p>
            </div>
            <Button size="sm" onClick={handleCreateToken} disabled={creating}>
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              New Token
            </Button>
          </div>

          <div className="space-y-3">
            {tokensLoading ? (
              <>
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </>
            ) : tokens.length === 0 ? (
              <div className="p-6 rounded-xl bg-card border border-border text-center">
                <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No API tokens yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a token to connect the Chrome extension.
                </p>
              </div>
            ) : (
              tokens.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-card border border-border flex items-center gap-3"
                >
                  <Key className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.label ?? "Chrome Extension"}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                      {t.token}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                      onClick={() => copyToken(t.token, t.id)}
                      title="Copy token"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {connected && (
                      <button
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-primary/20 transition-colors"
                        onClick={() => handleQuickConfigure(t.token)}
                        title="Send to extension"
                      >
                        <Send className="w-4 h-4 text-primary" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Configure Extension from Website */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Configure Extension
          </h2>
          <div className="p-5 rounded-xl bg-card border border-border space-y-5">
            {/* Connection status */}
            <div className="flex items-center gap-3">
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Detecting extension...</span>
                </>
              ) : connected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-400">
                    Extension detected -- configure it right here.
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-400">
                    Extension not detected.{" "}
                    <button
                      onClick={recheckExtension}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Retry
                    </button>
                  </span>
                </>
              )}
            </div>

            {connected ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    API Token
                  </label>
                  <Input
                    value={extToken}
                    onChange={(e) => setExtToken(e.target.value)}
                    placeholder="hc_..."
                    className="font-mono text-xs"
                  />
                  {tokens.length > 0 && !extToken && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Or click the <Send className="inline w-3 h-3" /> icon next to a token above
                      to auto-fill.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Dashboard URL
                  </label>
                  <Input
                    value={extUrl}
                    onChange={(e) => setExtUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    className="font-mono text-xs"
                  />
                </div>
                <Button onClick={handlePushSettings} disabled={pushing}>
                  {pushing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {pushing ? "Saving..." : "Push Settings to Extension"}
                </Button>
                {extSettings.apiToken && (
                  <div className="text-xs text-muted-foreground p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <Check className="inline w-3 h-3 text-green-500 mr-1" />
                    Extension is currently configured with token{" "}
                    <code className="font-mono text-green-400">
                      {extSettings.apiToken.slice(0, 16)}...
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Install the extension, then refresh this page. Once detected, you can configure
                  it without ever opening the popup!
                </p>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-medium">Load the extension</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Open{" "}
                        <code className="font-mono text-xs bg-secondary/50 px-1 rounded">
                          chrome://extensions
                        </code>
                        , enable Developer mode, click "Load unpacked", and select the extension
                        folder.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-medium">Refresh this page</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        The extension's content script needs to load on this page so we can
                        communicate with it.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-medium">Configure from here</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Once detected, you'll see fields to set the API token and URL -- no popup
                        needed!
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </section>

        {/* Keyboard shortcut info */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Keyboard Shortcut</h2>
          <div className="p-5 rounded-xl bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Once the extension is installed, select any text on any webpage and press:
            </p>
            <div className="flex items-center gap-2 text-sm">
              <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                Ctrl
              </kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                Shift
              </kbd>
              <span className="text-muted-foreground">+</span>
              <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-sm font-medium">
                S
              </kbd>
              <span className="text-muted-foreground ml-2">to save the highlighted text</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              A confirmation tooltip will appear briefly to confirm the save. The highlight will
              appear in your Mind Palace immediately.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **11.2** Update `src/pages/MindPalace.tsx` -- replace all tRPC calls with fetch-based state management. The key changes:

1. Remove `import { trpc } from "@/lib/trpc"`
2. Replace `trpc.highlights.list.useQuery(...)` with a custom `useHighlights` hook using fetch
3. Replace `trpc.tags.list.useQuery(...)` with `useEffect + fetch('/api/tags')`
4. Replace `trpc.highlights.domainStats.useQuery(...)` with fetch
5. Replace all mutation hooks with fetch-based async functions
6. Replace `trpc.useUtils()` with manual refetch callbacks
7. Remove `sendRandom` functionality (not in the spec for production)
8. Change the `getById` modal to fetch directly via `fetch('/api/highlights/${id}')` -- note: the current API does not have a single-item GET endpoint, so the modal should use the data already fetched in the list, or we add a client-side find. For simplicity, use the list data and re-fetch on update.

This is a large file. The complete rewrite follows the same UI structure but replaces every `trpc.xxx` call. Due to the size, the implementer should:
- Keep the entire JSX structure and UI components (TagChip, HighlightCard, etc.) unchanged
- Replace the data-fetching layer only
- Remove `import { trpc } from "@/lib/trpc"` and `import { getLoginUrl } from "@/const"`
- Remove the `sendRandom` button and mutation

The critical data-fetching changes (at the top of the default export):

```ts
// Replace trpc.highlights.list.useQuery with:
const [highlightsData, setHighlightsData] = useState<{ items: any[]; total: number } | null>(null);
const [highlightsLoading, setHighlightsLoading] = useState(true);

const fetchHighlights = useCallback(async () => {
  setHighlightsLoading(true);
  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (selectedTagId) params.set("tagId", String(selectedTagId));
  if (selectedDomain) params.set("domain", selectedDomain);
  params.set("page", String(Math.floor(offset / LIMIT) + 1));
  const res = await fetch(`/api/highlights?${params}`, { credentials: "include" });
  if (res.ok) setHighlightsData(await res.json());
  setHighlightsLoading(false);
}, [debouncedSearch, selectedTagId, selectedDomain, offset]);

useEffect(() => { fetchHighlights(); }, [fetchHighlights]);

// Replace trpc.tags.list.useQuery with:
const [tags, setTags] = useState<any[]>([]);
const fetchTags = useCallback(async () => {
  const res = await fetch("/api/tags", { credentials: "include" });
  if (res.ok) setTags(await res.json());
}, []);
useEffect(() => { fetchTags(); }, [fetchTags]);

// Replace trpc.highlights.domainStats.useQuery with:
const [domainStats, setDomainStats] = useState<any[]>([]);
const fetchDomainStats = useCallback(async () => {
  const res = await fetch("/api/highlights/domain-stats", { credentials: "include" });
  if (res.ok) setDomainStats(await res.json());
}, []);
useEffect(() => { fetchDomainStats(); }, [fetchDomainStats]);
```

The mutation replacements:
```ts
// Delete tag
const handleDeleteTag = async (id: number) => {
  await fetch(`/api/tags/${id}`, { method: "DELETE", credentials: "include" });
  fetchTags();
  if (selectedTagId === id) setSelectedTagId(undefined);
  toast.success("Tag deleted");
};

// Update highlight (in modal)
const handleUpdateHighlight = async (id: number, notes: string | null, tagIds: number[]) => {
  await fetch(`/api/highlights/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ notes, tagIds }),
  });
  fetchHighlights();
  toast.success("Highlight updated");
};

// Delete highlight (in modal)
const handleDeleteHighlight = async (id: number) => {
  await fetch(`/api/highlights/${id}`, { method: "DELETE", credentials: "include" });
  fetchHighlights();
  toast.success("Highlight deleted");
};

// Export
const handleExport = async (format: "json" | "markdown") => {
  const res = await fetch(`/api/highlights/export?format=${format}`, { credentials: "include" });
  if (res.ok) {
    const data = await res.json();
    const blob = new Blob([data.content], {
      type: format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${data.filename}`);
  }
};

// Create tag
const handleCreateTag = async (name: string, color: string) => {
  await fetch("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, color }),
  });
  fetchTags();
  toast.success("Tag created");
};
```

- [ ] **11.3** Update `src/pages/Home.tsx` -- replace `import { getLoginUrl } from "@/const"` and change `<a href={getLoginUrl()}>` to `<a href="/login">` (3 occurrences). Also change `<Button asChild>` links to use `onClick={() => navigate("/login")}` or keep as `<a href="/login">`.

- [ ] **11.4** Commit: "feat: replace tRPC with fetch calls in Settings, Mind Palace, Home pages"

---

## Task 12: Extension rewrite -- background.js

**Goal:** Rewrite the background service worker to use the new REST API endpoints instead of tRPC-formatted calls.

- [ ] **12.1** Rewrite `extension/background.js`:

**File: `extension/background.js`** (complete replacement)
```js
// Background Service Worker — Mind Palace (MV3)
// Handles: keyboard command relay, context menu, API calls

const CONFIGURED_DASHBOARD_URL = "(stored in chrome.storage.sync)";

// ─── Context Menu Setup ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save to Mind Palace",
    contexts: ["selection"],
  });
});

// ─── Context Menu Click ───────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-highlight" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TRIGGER_SAVE",
    });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "save-highlight" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" });
  }
});

// ─── Settings Helpers ─────────────────────────────────────────────────────────

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["apiToken", "dashboardUrl", "theme", "hasSeenTutorial"],
      (items) => {
        resolve({
          apiToken: items.apiToken || "",
          dashboardUrl: (items.dashboardUrl || "").replace(/\/$/, ""),
          theme: items.theme || "dark",
          hasSeenTutorial: items.hasSeenTutorial || false,
        });
      }
    );
  });
}

function saveSettings(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => resolve(true));
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_HIGHLIGHT") {
    handleSaveHighlight(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_RECENT") {
    handleGetRecent()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then((settings) => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const updates = {};
    if (message.apiToken !== undefined) updates.apiToken = message.apiToken;
    if (message.dashboardUrl !== undefined) updates.dashboardUrl = message.dashboardUrl;
    if (message.theme !== undefined) updates.theme = message.theme;
    if (message.hasSeenTutorial !== undefined) updates.hasSeenTutorial = message.hasSeenTutorial;
    saveSettings(updates).then(() => sendResponse({ success: true }));
    return true;
  }
});

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function handleSaveHighlight(payload) {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken || !dashboardUrl) {
    throw new Error(
      "Please configure your API token and dashboard URL in the extension settings."
    );
  }

  const response = await fetch(`${dashboardUrl}/api/extension/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiToken,
      text: payload.text,
      sourceUrl: payload.sourceUrl,
      pageTitle: payload.pageTitle,
      domain: payload.domain,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function handleGetRecent() {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken || !dashboardUrl) {
    return [];
  }

  const response = await fetch(
    `${dashboardUrl}/api/extension/recent?apiToken=${encodeURIComponent(apiToken)}`,
    { method: "GET" }
  );

  if (!response.ok) return [];
  return response.json();
}
```

- [ ] **12.2** Commit: "feat: rewrite extension background.js for REST API"

---

## Task 13: Extension rewrite -- content.js

**Goal:** Rewrite the content script with the new DOM bridge protocol, first-time tutorial popup, and silent toast for subsequent saves.

- [ ] **13.1** Rewrite `extension/content.js`:

**File: `extension/content.js`** (complete replacement)
```js
// Content Script — Mind Palace (MV3)
// Listens for Ctrl+Shift+S, captures selection, shows tutorial or silent toast

(function () {
  "use strict";

  if (window.__mindPalaceLoaded) return;
  window.__mindPalaceLoaded = true;

  // ─── DOM Bridge: Announce extension presence ────────────────────────────────
  document.documentElement.setAttribute("data-hc-extension", "true");
  document.dispatchEvent(new CustomEvent("HC_EXTENSION_PRESENT"));

  // ─── DOM Bridge: Settings exchange ──────────────────────────────────────────

  document.addEventListener("HC_GET_SETTINGS", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      document.dispatchEvent(
        new CustomEvent("HC_SETTINGS_RESPONSE", {
          detail: {
            apiToken: response?.apiToken || "",
            dashboardUrl: response?.dashboardUrl || "",
            theme: response?.theme || "dark",
          },
        })
      );
    });
  });

  document.addEventListener("HC_SAVE_SETTINGS", (e) => {
    const detail = e.detail || {};
    chrome.runtime.sendMessage(
      {
        type: "SAVE_SETTINGS",
        apiToken: detail.apiToken,
        dashboardUrl: detail.dashboardUrl,
        theme: detail.theme,
      },
      (response) => {
        document.dispatchEvent(
          new CustomEvent("HC_SETTINGS_SAVED", {
            detail: { success: response?.success },
          })
        );
      }
    );
  });

  // ─── Theme helper ──────────────────────────────────────────────────────────

  function getThemeColors(callback) {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      const isDark = (response?.theme || "dark") === "dark";
      callback(
        isDark
          ? {
              bg: "#0c0b09",
              card: "#161410",
              text: "#f5efe6",
              muted: "rgba(235,220,190,0.38)",
              accent: "#e8d9c0",
              border: "rgba(235,220,190,0.12)",
              gradient: "linear-gradient(135deg, #c9b99a, #e8d9c0)",
            }
          : {
              bg: "#faf8f5",
              card: "#ffffff",
              text: "#1a1510",
              muted: "#8a7a60",
              accent: "#8a7560",
              border: "rgba(180,160,130,0.2)",
              gradient: "linear-gradient(135deg, #8a7560, #b5a080)",
            }
      );
    });
  }

  // ─── Shadow DOM Host ───────────────────────────────────────────────────────

  let hostEl = null;
  let shadow = null;

  function ensureShadowHost() {
    if (hostEl) return;
    hostEl = document.createElement("div");
    hostEl.id = "__hc-ui-host";
    hostEl.style.cssText =
      "position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;pointer-events:none;";
    document.body.appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: "closed" });
  }

  function clearShadow() {
    if (!shadow) return;
    while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
  }

  // ─── Silent Toast ──────────────────────────────────────────────────────────

  function showSilentToast(savedHighlight) {
    ensureShadowHost();
    clearShadow();

    getThemeColors((c) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position:fixed;bottom:24px;right:24px;pointer-events:auto;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        z-index:2147483647;
      `;

      const toast = document.createElement("div");
      toast.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:10px 16px;border-radius:12px;
        background:${c.card};color:${c.text};
        border:1px solid ${c.border};
        box-shadow:0 8px 32px rgba(0,0,0,0.3);
        font-size:13px;font-weight:500;
        opacity:0;transform:translateY(8px);
        transition:opacity 0.3s ease,transform 0.3s ease;
      `;

      const star = document.createElement("span");
      star.textContent = "\u2726 Saved";
      star.style.cssText = `background:${c.gradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600;`;

      const noteBtn = document.createElement("button");
      noteBtn.textContent = "\uFF0B Note";
      noteBtn.style.cssText = `
        background:transparent;border:1px solid ${c.border};color:${c.muted};
        padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;
        transition:color 0.15s;pointer-events:auto;
      `;
      noteBtn.addEventListener("mouseenter", () => { noteBtn.style.color = c.text; });
      noteBtn.addEventListener("mouseleave", () => { noteBtn.style.color = c.muted; });
      noteBtn.addEventListener("click", () => {
        if (savedHighlight?.id) {
          chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
            const url = response?.dashboardUrl || "";
            if (url) {
              window.open(`${url}/mind-palace`, "_blank");
            }
          });
        }
      });

      toast.appendChild(star);
      toast.appendChild(noteBtn);
      wrapper.appendChild(toast);
      shadow.appendChild(wrapper);

      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });

      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
        setTimeout(() => {
          clearShadow();
        }, 300);
      }, 3000);
    });
  }

  // ─── Tutorial Popup ────────────────────────────────────────────────────────

  function showTutorialPopup(savedText, selectionRect) {
    ensureShadowHost();
    clearShadow();

    getThemeColors((c) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position:fixed;z-index:2147483647;pointer-events:auto;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      `;

      // Position near selection
      const top = Math.min(selectionRect.bottom + window.scrollY + 12, window.innerHeight - 250);
      const left = Math.max(16, Math.min(selectionRect.left + window.scrollX, window.innerWidth - 320));
      wrapper.style.top = top + "px";
      wrapper.style.left = left + "px";

      const card = document.createElement("div");
      card.style.cssText = `
        width:300px;padding:20px;border-radius:16px;
        background:${c.card};color:${c.text};
        border:1px solid ${c.border};
        box-shadow:0 12px 48px rgba(0,0,0,0.4);
        opacity:0;transform:translateY(8px) scale(0.97);
        transition:opacity 0.3s ease,transform 0.3s ease;
      `;

      const preview = savedText.length > 100 ? savedText.slice(0, 100) + "\u2026" : savedText;

      card.innerHTML = `
        <div style="font-size:16px;font-weight:600;margin-bottom:8px;background:${c.gradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
          \u2726 Saved!
        </div>
        <div style="font-size:12px;color:${c.muted};line-height:1.5;margin-bottom:14px;font-style:italic;">
          "${preview}"
        </div>
        <div style="font-size:11px;color:${c.muted};margin-bottom:16px;">
          Press <strong style="color:${c.text}">Ctrl+Shift+S</strong> anytime to save highlights from any page.
        </div>
        <div style="display:flex;gap:8px;">
          <button id="hc-note-btn" style="
            flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:500;
            background:${c.gradient};color:${c.bg};border:none;cursor:pointer;
          ">Add a note \u2192</button>
          <button id="hc-dismiss-btn" style="
            padding:8px 12px;border-radius:8px;font-size:12px;
            background:transparent;color:${c.muted};border:1px solid ${c.border};cursor:pointer;
          ">Dismiss</button>
        </div>
      `;

      wrapper.appendChild(card);
      shadow.appendChild(wrapper);

      // Animate in
      requestAnimationFrame(() => {
        card.style.opacity = "1";
        card.style.transform = "translateY(0) scale(1)";
      });

      // Button handlers
      card.querySelector("#hc-note-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
          const url = response?.dashboardUrl || "";
          if (url) window.open(`${url}/mind-palace`, "_blank");
        });
        clearShadow();
      });

      card.querySelector("#hc-dismiss-btn").addEventListener("click", () => {
        card.style.opacity = "0";
        card.style.transform = "translateY(8px) scale(0.97)";
        setTimeout(clearShadow, 300);
      });

      // Mark tutorial as seen
      chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", hasSeenTutorial: true });
    });
  }

  // ─── Capture & Save ────────────────────────────────────────────────────────

  function getSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";
    return sel.toString().trim();
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function getSelectionRect() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      return sel.getRangeAt(0).getBoundingClientRect();
    }
    return { top: window.innerHeight / 2, bottom: window.innerHeight / 2, left: window.innerWidth / 2, right: window.innerWidth / 2 };
  }

  async function saveHighlight() {
    const text = getSelectedText();
    const rect = getSelectionRect();

    if (!text) {
      showSilentToast(null);
      // Show a brief error instead
      ensureShadowHost();
      clearShadow();
      getThemeColors((c) => {
        const el = document.createElement("div");
        el.style.cssText = `
          position:fixed;bottom:24px;right:24px;pointer-events:auto;
          padding:10px 16px;border-radius:12px;
          background:#ef4444;color:white;font-size:13px;font-weight:500;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          box-shadow:0 8px 32px rgba(0,0,0,0.3);
          opacity:0;transform:translateY(8px);
          transition:opacity 0.3s ease,transform 0.3s ease;
        `;
        el.textContent = "Select some text first";
        shadow.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
        setTimeout(() => { el.style.opacity = "0"; setTimeout(clearShadow, 300); }, 2500);
      });
      return;
    }

    if (text.length > 50000) {
      return;
    }

    const payload = {
      text,
      sourceUrl: window.location.href,
      pageTitle: document.title || "",
      domain: getDomain(window.location.href),
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_HIGHLIGHT",
        payload,
      });

      if (response?.success) {
        window.getSelection()?.removeAllRanges();

        // Check if first time
        chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
          if (!settings?.hasSeenTutorial) {
            showTutorialPopup(text, rect);
          } else {
            showSilentToast(response.data);
          }
        });
      } else {
        const errMsg = response?.error || "Failed to save";
        showSilentToast(null);
      }
    } catch (err) {
      console.error("[Mind Palace] Error:", err);
    }
  }

  // ─── Keyboard Shortcut (Ctrl+Shift+S) ──────────────────────────────────────

  document.addEventListener(
    "keydown",
    (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        saveHighlight();
      }
    },
    true
  );

  // ─── Message from background (context menu / command relay) ────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRIGGER_SAVE") {
      saveHighlight();
    }
  });
})();
```

- [ ] **13.2** Commit: "feat: rewrite extension content.js with tutorial and silent toast"

---

## Task 14: Extension rewrite -- popup.html + popup.js

**Goal:** Rebuild the popup with the luxury dual-theme UI, onboarding view, main view, and settings view.

- [ ] **14.1** Rewrite `extension/popup.html`:

**File: `extension/popup.html`** (complete replacement)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mind Palace</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ─── Theme Variables ─── */
    .theme-dark {
      --bg: #0c0b09; --bg2: #161410; --bg3: #1e1b16;
      --border: rgba(235,220,190,0.12); --text: #f5efe6;
      --text-muted: rgba(235,220,190,0.38); --accent: #e8d9c0;
      --accent-gradient: linear-gradient(135deg, #c9b99a, #e8d9c0);
      --success: #22c55e; --error: #ef4444;
    }
    .theme-light {
      --bg: #faf8f5; --bg2: #ffffff; --bg3: #f0ebe4;
      --border: rgba(180,160,130,0.2); --text: #1a1510;
      --text-muted: #8a7a60; --accent: #8a7560;
      --accent-gradient: linear-gradient(135deg, #8a7560, #b5a080);
      --success: #16a34a; --error: #dc2626;
    }

    body {
      width: 360px; min-height: 200px; max-height: 560px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; overflow: hidden;
    }

    /* ─── Header ─── */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--bg2);
    }
    .header-left { display: flex; align-items: center; gap: 8px; }
    .logo {
      width: 26px; height: 26px; border-radius: 8px;
      background: var(--accent-gradient);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: var(--bg);
    }
    .title { font-weight: 600; font-size: 13px; letter-spacing: -0.01em; }
    .icon-btn {
      width: 28px; height: 28px; border-radius: 6px;
      background: transparent; border: none; cursor: pointer;
      color: var(--text-muted); display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .icon-btn:hover { background: var(--bg3); color: var(--text); }
    .icon-btn svg { width: 14px; height: 14px; }

    /* ─── Views ─── */
    .view { display: none; flex-direction: column; }
    .view.active { display: flex; }

    /* ─── Onboarding ─── */
    #view-onboarding {
      padding: 32px 24px; align-items: center; text-align: center; gap: 16px;
    }
    .onboard-logo { font-size: 32px; margin-bottom: 4px; }
    .onboard-tagline { font-size: 14px; color: var(--text-muted); font-style: italic; }
    .btn-accent {
      width: 100%; padding: 10px 16px; border-radius: 10px;
      background: var(--accent-gradient); border: none; cursor: pointer;
      color: var(--bg); font-size: 13px; font-weight: 600;
      transition: opacity 0.15s, transform 0.15s;
    }
    .btn-accent:hover { opacity: 0.9; transform: scale(1.02); }
    .btn-accent:active { transform: scale(0.98); }
    .divider {
      display: flex; align-items: center; gap: 12px; width: 100%;
      font-size: 11px; color: var(--text-muted);
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }
    .btn-outline {
      width: 100%; padding: 10px 16px; border-radius: 10px;
      background: transparent; border: 1px solid var(--border); cursor: pointer;
      color: var(--text); font-size: 13px; font-weight: 500;
      transition: background 0.15s, border-color 0.15s;
    }
    .btn-outline:hover { background: var(--bg3); border-color: var(--accent); }
    .shortcut-hint {
      font-size: 11px; color: var(--text-muted); margin-top: 8px;
    }
    .shortcut-hint kbd {
      padding: 1px 5px; border-radius: 4px;
      background: var(--bg3); border: 1px solid var(--border);
      font-family: monospace; font-size: 11px; color: var(--text);
    }

    /* ─── Main View ─── */
    .section-title {
      padding: 10px 14px 6px; font-size: 10px; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
    }
    #highlights-list { overflow-y: auto; max-height: 340px; }
    .highlight-item {
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      cursor: default; transition: background 0.12s;
    }
    .highlight-item:hover { background: var(--bg2); }
    .highlight-item:last-child { border-bottom: none; }
    .hi-text {
      font-style: italic; font-size: 12px; line-height: 1.55; color: var(--text);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden; margin-bottom: 5px;
    }
    .hi-meta {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 10px; color: var(--text-muted);
    }
    .hi-domain { display: flex; align-items: center; gap: 3px; }
    .hi-domain svg { width: 10px; height: 10px; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px 20px; text-align: center; gap: 8px;
    }
    .empty-icon { font-size: 28px; opacity: 0.4; }
    .empty-title { font-weight: 500; color: var(--text); font-size: 13px; }
    .empty-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; }

    .footer {
      padding: 10px 14px; border-top: 1px solid var(--border); background: var(--bg2);
    }
    .btn-primary {
      width: 100%; padding: 8px 12px; border-radius: 10px;
      background: var(--accent-gradient); border: none; cursor: pointer; color: var(--bg);
      font-size: 12px; font-weight: 600;
      transition: transform 0.2s, opacity 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-primary:hover { opacity: 0.9; transform: scale(1.02); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary svg { width: 13px; height: 13px; }

    /* ─── Settings View ─── */
    #view-settings { padding: 14px; gap: 12px; }
    .settings-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
    }
    .settings-header .icon-btn { width: auto; padding: 2px; }
    .settings-title { font-size: 13px; font-weight: 600; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 500;
    }
    .status-badge.connected { background: rgba(34,197,94,0.1); color: var(--success); }
    .status-badge.disconnected { background: rgba(239,68,68,0.1); color: var(--error); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .status-badge.connected .status-dot { background: var(--success); }
    .status-badge.disconnected .status-dot { background: var(--error); }

    .theme-toggle {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0;
    }
    .toggle-track {
      width: 40px; height: 22px; border-radius: 11px;
      background: var(--bg3); border: 1px solid var(--border);
      position: relative; cursor: pointer; transition: background 0.2s;
    }
    .toggle-thumb {
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--accent); position: absolute; top: 1px; left: 1px;
      transition: transform 0.2s;
    }
    .toggle-track.active .toggle-thumb { transform: translateX(18px); }

    .separator { height: 1px; background: var(--border); margin: 4px 0; }

    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 11px; font-weight: 500; color: var(--text-muted); }
    .field input {
      padding: 7px 10px; border-radius: 8px;
      background: var(--bg3); border: 1px solid var(--border);
      color: var(--text); font-size: 12px; font-family: monospace;
      outline: none; transition: border-color 0.15s;
    }
    .field input:focus { border-color: var(--accent); }
    .field input::placeholder { color: var(--text-muted); font-family: inherit; }

    .btn-save {
      padding: 8px 12px; border-radius: 8px;
      background: var(--accent); border: none; cursor: pointer;
      color: var(--bg); font-size: 12px; font-weight: 600;
      transition: opacity 0.15s; width: 100%;
    }
    .btn-save:hover { opacity: 0.85; }

    .status-msg {
      font-size: 11px; padding: 6px 10px; border-radius: 6px;
      text-align: center; display: none;
    }
    .status-msg.success { background: rgba(34,197,94,0.15); color: var(--success); display: block; }
    .status-msg.error { background: rgba(239,68,68,0.15); color: var(--error); display: block; }

    .spinner {
      width: 16px; height: 16px; border: 2px solid var(--border);
      border-top-color: var(--accent); border-radius: 50%;
      animation: spin 0.7s linear infinite; margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body class="theme-dark">

  <!-- Header (shown on main + settings views) -->
  <div class="header" id="header">
    <div class="header-left">
      <div class="logo">\u2726</div>
      <span class="title">Mind Palace</span>
    </div>
    <div>
      <button class="icon-btn" id="btn-settings" title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Onboarding View -->
  <div class="view" id="view-onboarding">
    <div class="onboard-logo">\u2726</div>
    <span class="title" style="font-size:18px;">Mind Palace</span>
    <p class="onboard-tagline">Your knowledge, captured.</p>
    <button class="btn-accent" id="btn-create-account">Create free account</button>
    <div class="divider"><span>already a member?</span></div>
    <button class="btn-outline" id="btn-sign-in">Sign in</button>
    <p class="shortcut-hint">
      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> to save highlights
    </p>
  </div>

  <!-- Main View -->
  <div class="view" id="view-main">
    <div class="section-title">Recent Highlights</div>
    <div id="highlights-list"><div class="spinner"></div></div>
    <div class="footer">
      <button class="btn-primary" id="btn-open-dashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Open Dashboard \u2192
      </button>
    </div>
  </div>

  <!-- Settings View -->
  <div class="view" id="view-settings">
    <div class="settings-header">
      <button class="icon-btn" id="btn-back" title="Back">\u2190</button>
      <span class="settings-title">Settings</span>
    </div>

    <div id="connection-status"></div>

    <div class="theme-toggle">
      <span style="font-size:12px;">Theme</span>
      <div class="toggle-track" id="theme-toggle">
        <div class="toggle-thumb"></div>
      </div>
    </div>

    <div class="separator"></div>

    <div class="field">
      <label>Dashboard URL</label>
      <input type="url" id="input-dashboard-url" placeholder="https://mind-palace-v2.vercel.app" />
    </div>
    <div class="field">
      <label>API Token</label>
      <input type="password" id="input-api-token" placeholder="hc_..." />
    </div>
    <div id="settings-status" class="status-msg"></div>
    <button class="btn-save" id="btn-save-settings">Save</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **14.2** Rewrite `extension/popup.js`:

**File: `extension/popup.js`** (complete replacement)
```js
// Popup Script — Mind Palace

document.addEventListener("DOMContentLoaded", () => {
  const CONFIGURED_DASHBOARD_URL = "(stored in chrome.storage.sync)";

  // ─── Elements ────────────────────────────────────────────────────────────
  const header = document.getElementById("header");
  const viewOnboarding = document.getElementById("view-onboarding");
  const viewMain = document.getElementById("view-main");
  const viewSettings = document.getElementById("view-settings");
  const highlightsList = document.getElementById("highlights-list");
  const btnSettings = document.getElementById("btn-settings");
  const btnBack = document.getElementById("btn-back");
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");
  const btnCreateAccount = document.getElementById("btn-create-account");
  const btnSignIn = document.getElementById("btn-sign-in");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const inputDashboardUrl = document.getElementById("input-dashboard-url");
  const inputApiToken = document.getElementById("input-api-token");
  const settingsStatus = document.getElementById("settings-status");
  const connectionStatus = document.getElementById("connection-status");
  const themeToggle = document.getElementById("theme-toggle");

  let currentTheme = "dark";

  // ─── View Switching ──────────────────────────────────────────────────────

  function showView(name) {
    viewOnboarding.classList.remove("active");
    viewMain.classList.remove("active");
    viewSettings.classList.remove("active");
    header.style.display = name === "onboarding" ? "none" : "flex";
    if (name === "onboarding") viewOnboarding.classList.add("active");
    if (name === "main") viewMain.classList.add("active");
    if (name === "settings") viewSettings.classList.add("active");
  }

  // ─── Theme ────────────────────────────────────────────────────────────────

  function applyTheme(theme) {
    currentTheme = theme;
    document.body.className = theme === "light" ? "theme-light" : "theme-dark";
    if (theme === "light") {
      themeToggle.classList.add("active");
    } else {
      themeToggle.classList.remove("active");
    }
  }

  themeToggle.addEventListener("click", () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", theme: newTheme });
  });

  // ─── Settings ─────────────────────────────────────────────────────────────

  function loadSettingsIntoForm() {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (response) {
        inputDashboardUrl.value = response.dashboardUrl || "";
        inputApiToken.value = response.apiToken || "";
        applyTheme(response.theme || "dark");

        // Connection status
        if (response.apiToken) {
          connectionStatus.innerHTML =
            '<div class="status-badge connected"><span class="status-dot"></span>Connected</div>';
        } else {
          connectionStatus.innerHTML =
            '<div class="status-badge disconnected"><span class="status-dot"></span>Not connected</div>';
        }
      }
    });
  }

  btnSettings.addEventListener("click", () => {
    loadSettingsIntoForm();
    showView("settings");
  });

  btnBack.addEventListener("click", () => {
    showView("main");
    loadRecent();
  });

  btnSaveSettings.addEventListener("click", () => {
    const dashboardUrl = inputDashboardUrl.value.trim().replace(/\/$/, "");
    const apiToken = inputApiToken.value.trim();

    if (!dashboardUrl) {
      showStatus("Please enter the dashboard URL", "error");
      return;
    }
    if (!apiToken) {
      showStatus("Please enter your API token", "error");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "SAVE_SETTINGS", apiToken, dashboardUrl },
      () => {
        showStatus("Settings saved!", "success");
        setTimeout(() => {
          showView("main");
          loadRecent();
        }, 1000);
      }
    );
  });

  function showStatus(msg, type) {
    settingsStatus.textContent = msg;
    settingsStatus.className = "status-msg " + type;
    setTimeout(() => {
      settingsStatus.className = "status-msg";
    }, 3000);
  }

  // ─── Onboarding Buttons ────────────────────────────────────────────────────

  btnCreateAccount.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      const url = response?.dashboardUrl || "";
      chrome.tabs.create({ url: url + "/register" });
      window.close();
    });
  });

  btnSignIn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      const url = response?.dashboardUrl || "";
      chrome.tabs.create({ url: url + "/login" });
      window.close();
    });
  });

  // ─── Open Dashboard ────────────────────────────────────────────────────────

  btnOpenDashboard.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      const url = response?.dashboardUrl || "";
      chrome.tabs.create({ url: url + "/mind-palace" });
      window.close();
    });
  });

  // ─── Load Recent Highlights ────────────────────────────────────────────────

  function loadRecent() {
    highlightsList.innerHTML = '<div class="spinner"></div>';

    chrome.runtime.sendMessage({ type: "GET_RECENT" }, (response) => {
      if (chrome.runtime.lastError) {
        renderEmpty();
        return;
      }

      if (!response?.success) {
        renderEmpty();
        return;
      }

      const items = response.data;
      if (!items || items.length === 0) {
        renderEmpty();
      } else {
        renderHighlights(items);
      }
    });
  }

  function renderHighlights(items) {
    highlightsList.innerHTML = "";
    items.forEach((h) => {
      const div = document.createElement("div");
      div.className = "highlight-item";
      const domain = h.domain || tryGetDomain(h.source_url || h.sourceUrl);
      const date = new Date(h.created_at || h.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const text =
        h.text.length > 140 ? h.text.slice(0, 140) + "\u2026" : h.text;

      div.innerHTML = `
        <div class="hi-text">\u201C${escapeHtml(text)}\u201D</div>
        <div class="hi-meta">
          <div class="hi-domain">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            ${escapeHtml(domain)}
          </div>
          <span>${date}</span>
        </div>
      `;
      highlightsList.appendChild(div);
    });
  }

  function renderEmpty() {
    highlightsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u2726</div>
        <div class="empty-title">No highlights yet</div>
        <div class="empty-desc">
          Select text on any webpage and press<br>
          <strong>Ctrl+Shift+S</strong> to save your first highlight.
        </div>
      </div>
    `;
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function tryGetDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url || "unknown";
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    applyTheme(response?.theme || "dark");

    if (!response?.apiToken) {
      showView("onboarding");
    } else {
      showView("main");
      loadRecent();
    }
  });
});
```

- [ ] **14.3** Commit: "feat: rewrite extension popup with dual-theme luxury UI and onboarding"

---

## Task 15: Final wiring and deploy prep

**Goal:** Update manifest permissions, create deploy docs, final cleanup.

- [ ] **15.1** Update `extension/manifest.json` -- change `host_permissions` to be more specific while still supporting both production and local dev:

In the `host_permissions` array, replace `"<all_urls>"` with:
```json
"host_permissions": [
  "https://*.vercel.app/*",
  "http://localhost:*/*"
]
```

Keep the `"<all_urls>"` in the `content_scripts.matches` array (the content script must run on all pages to capture highlights).

- [ ] **15.2** Create `DEPLOY.md` at project root:

**File: `DEPLOY.md`**
```markdown
# Mind Palace — Deployment Guide

## 1. Database (Neon Postgres)

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project and database
3. Copy the connection string (format: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. Run the migration SQL from `drizzle/0001_init.sql` in the Neon SQL editor

## 2. Vercel Deployment

1. Push this repo to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Set environment variables in Vercel project settings:
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — a random 64-character string (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
4. Deploy — Vercel auto-detects Vite + serverless functions

## 3. Extension Setup

1. Configure the dashboard URL through extension settings; do not hardcode deployment secrets in source
2. Load the extension in Chrome/Edge:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension/` folder
3. Click the extension icon — it will show the onboarding screen
4. Click "Create free account" or "Sign in" — the extension auto-configures after login

## 4. Local Development

```bash
# Install deps
npm install

# Create .env.local with DATABASE_URL and JWT_SECRET
cp .env.local.example .env.local
# Edit .env.local with your values

# Run Vite dev server (frontend)
npm run dev

# Run Vercel dev server (API functions) in another terminal
npx vercel dev
```

The Vite dev server proxies `/api/*` requests to the Vercel dev server on port 3000.
```

- [ ] **15.3** Delete `src/const.ts` (only contained `getLoginUrl` which is no longer used -- login URL is now hardcoded as `/login` everywhere):
```bash
rm src/const.ts
```

- [ ] **15.4** Verify the build works:
```bash
npm run build
# Expected: successful Vite build with no TypeScript errors
```

- [ ] **15.5** Final commit: "chore: deployment config, manifest update, cleanup"

---

## Self-Review Checklist

| Spec Section | Covered By | Status |
|---|---|---|
| Architecture (Vercel + Neon) | Tasks 1, 2, 15 | Covered |
| Auth (bcrypt + JWT + cookie) | Tasks 3, 5 | Covered |
| Database schema (Postgres) | Task 2 | Covered |
| API routes — Auth | Task 5 | Covered |
| API routes — Highlights | Task 6 | Covered |
| API routes — Tags | Task 7 | Covered |
| API routes — Tokens | Task 7 | Covered |
| API routes — Extension | Task 7 | Covered |
| Extension background.js | Task 12 | Covered |
| Extension content.js (bridge + tutorial + toast) | Task 13 | Covered |
| Extension popup (onboarding + main + settings) | Task 14 | Covered |
| Extension themes (dual) | Tasks 13, 14 | Covered |
| Dashboard Login page | Task 10 | Covered |
| Dashboard Register page | Task 10 | Covered |
| Dashboard Mind Palace page (fetch migration) | Task 11 | Covered |
| Dashboard Settings page (fetch + theme toggle) | Task 11 | Covered |
| Dashboard Home page (link fixes) | Task 11 | Covered |
| ThemeContext (data-theme, DB persist) | Task 9 | Covered |
| AuthContext (useAuth hook) | Task 8 | Covered |
| CSS theme variables (dark + light) | Task 9 | Covered |
| Auto-config flow (extension bridge) | Tasks 10, 13 | Covered |
| Keyword tagger (replace Ollama) | Task 4 | Covered |
| vercel.json | Task 1 | Covered |
| Deploy instructions | Task 15 | Covered |
| Delete old files | Task 1 | Covered |

**Type/function name consistency check:**
- `signJwt` / `verifyJwt` — defined in Task 3, used in Tasks 5, 6, 7
- `setSessionCookie` / `clearSessionCookie` — defined in Task 3, used in Tasks 5
- `inferTags` — defined in Task 4, used in Tasks 6, 7
- `db` — defined in Task 2, imported as `../../src/lib/db` in all API routes
- `users`, `apiTokens`, `tags`, `highlights` — defined in Task 2, imported as `../../src/schema` in all API routes
- `useAuth` — defined in Task 8 (AuthContext), re-exported in Task 8 (useAuth.ts), used by Tasks 9, 10, 11
- `useTheme` / `toggleTheme` — defined in Task 9, used in Task 11
- `parseCookies` — duplicated in several API files (acceptable for serverless isolation; could be extracted to a shared util but keeping it inline reduces cross-file deps for serverless bundling)

**No placeholder patterns found.** All code blocks are complete.

---

### Critical Files for Implementation

- `M:\AI\Knowledge_Area51\src\schema.ts` -- the foundation schema that every API route and the db client depend on; must be converted from MySQL to Postgres first
- `M:\AI\Knowledge_Area51\src\lib\auth.ts` -- new file; JWT sign/verify and cookie helpers used by every authenticated API route
- `M:\AI\Knowledge_Area51\src\lib\db.ts` -- new file; Neon HTTP client that all API routes import
- `M:\AI\Knowledge_Area51\src\contexts\AuthContext.tsx` -- new file; central auth state that the entire React app (routing, pages, theme) depends on
- `M:\AI\Knowledge_Area51\src\pages\MindPalace.tsx` -- largest existing file requiring migration from tRPC to fetch; the most complex rewrite in the frontend