# Security Hardening & Test Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Vitest test suite (currently imports tRPC artifacts that no longer exist) and add in-memory rate limiting, CORS headers, centralized auth helper, and input validation improvements to all Vercel API handlers.

**Architecture:** New shared utilities (`src/lib/rate-limit.ts`, `src/lib/cors.ts`) are imported by API handlers. The duplicated `parseCookies`/`getAuthUserIdFromVercelReq` pattern is added to `src/lib/auth.ts` and all 5 handler files that currently duplicate it are updated to use it. Tests are rewritten to call Vercel handler functions directly using mock req/res helpers — no tRPC.

**Tech Stack:** TypeScript, Vitest, Vercel serverless handlers (`@vercel/node`), Drizzle ORM, `jose` (JWT), `bcryptjs`, `nanoid`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/rate-limit.ts` | **Create** | In-memory sliding-window rate limiter |
| `src/lib/cors.ts` | **Create** | CORS header helper + OPTIONS preflight |
| `src/lib/auth.ts` | **Modify** | Add `getAuthUserIdFromVercelReq` helper |
| `highlights.test.ts` | **Rewrite** | 16 tests against Vercel handlers directly |
| `api/highlights/index.ts` | **Modify** | Use shared auth helper, add CORS, add URL validation |
| `api/highlights/[id].ts` | **Modify** | Use shared auth helper, add CORS |
| `api/highlights/export.ts` | **Modify** | Use shared auth helper, add CORS |
| `api/tags/index.ts` | **Modify** | Use shared auth helper, add CORS |
| `api/tokens/index.ts` | **Modify** | Use shared auth helper, add CORS, label length validation |
| `api/tokens/[id].ts` | **Modify** | Use shared auth helper, add CORS |
| `api/auth/login.ts` | **Modify** | Add rate limiting, CORS, input length limits |
| `api/auth/register.ts` | **Modify** | Add rate limiting, CORS |
| `api/extension/save.ts` | **Modify** | Add rate limiting, CORS, URL/domain validation |
| `api/extension/recent.ts` | **Modify** | Add CORS |

---

## Task 1: Rate Limiter Utility

**Files:**
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: Create `src/lib/rate-limit.ts`**

```typescript
// In-memory sliding-window rate limiter.
// NOT persistent — resets when the Vercel function instance restarts.
// Suitable for abuse prevention; upgrade to Redis for strict enforcement.

const store = new Map<string, number[]>();

export interface RateLimitConfig {
  windowMs: number; // window size in milliseconds
  max: number;      // max requests allowed per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function rateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = (store.get(ip) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  store.set(ip, timestamps);

  const allowed = timestamps.length <= config.max;
  const remaining = Math.max(0, config.max - timestamps.length);
  return { allowed, remaining };
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.trim() ?? "unknown";
  return "unknown";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: add in-memory sliding-window rate limiter utility"
```

---

## Task 2: CORS Utility

**Files:**
- Create: `src/lib/cors.ts`

- [ ] **Step 1: Create `src/lib/cors.ts`**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Returns true if the request was an OPTIONS preflight (caller should return early).
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = process.env.CORS_ORIGIN ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cors.ts
git commit -m "feat: add CORS helper utility"
```

---

## Task 3: Centralize Auth Helper

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add `getAuthUserIdFromVercelReq` to `src/lib/auth.ts`**

Add the following export at the bottom of the existing file (after `clearSessionCookie`). Do not remove anything already there.

```typescript
import type { VercelRequest } from "@vercel/node";

export async function getAuthUserIdFromVercelReq(req: VercelRequest): Promise<number | null> {
  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  const token = cookies["mp_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}
```

Note: `verifyJwt` is already defined earlier in `src/lib/auth.ts` — this function reuses it.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add getAuthUserIdFromVercelReq to centralize cookie auth"
```

---

## Task 4: Update `api/highlights/index.ts`

**Files:**
- Modify: `api/highlights/index.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { inferTags } from "../../src/lib/keyword-tags";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

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

    if (domain) conditions.push(eq(highlights.domain, domain));

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
      db.select().from(highlights).where(whereClause).orderBy(desc(highlights.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(highlights).where(whereClause),
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

    if (!text || typeof text !== "string" || text.length === 0)
      return res.status(400).json({ error: "Text is required" });
    if (text.length > 50000)
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });
    if (!sourceUrl || typeof sourceUrl !== "string")
      return res.status(400).json({ error: "Source URL is required" });
    if (!/^https?:\/\//i.test(sourceUrl))
      return res.status(400).json({ error: "Source URL must start with http:// or https://" });

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

- [ ] **Step 2: Commit**

```bash
git add api/highlights/index.ts
git commit -m "refactor: use shared auth/cors helpers, add URL validation in highlights index"
```

---

## Task 5: Update `api/highlights/[id].ts`

**Files:**
- Modify: `api/highlights/[id].ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid highlight ID" });

  if (req.method === "PATCH") {
    const { notes, tagIds } = req.body ?? {};
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    if (tagIds !== undefined) {
      if (!Array.isArray(tagIds)) return res.status(400).json({ error: "tagIds must be an array" });
      updateData.tagIds = JSON.stringify(tagIds);
    }

    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);
    if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });

    await db.update(highlights).set(updateData).where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
    const updated = await db.select().from(highlights).where(eq(highlights.id, id)).limit(1);
    return res.status(200).json(updated[0]);
  }

  if (req.method === "DELETE") {
    const existing = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
      .limit(1);
    if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });
    await db.delete(highlights).where(and(eq(highlights.id, id), eq(highlights.userId, userId)));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 2: Commit**

```bash
git add "api/highlights/[id].ts"
git commit -m "refactor: use shared auth/cors helpers in highlights [id] handler"
```

---

## Task 6: Update `api/highlights/export.ts`

**Files:**
- Modify: `api/highlights/export.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "markdown")
    return res.status(400).json({ error: "Format must be 'json' or 'markdown'" });

  const [allHighlights, allTags] = await Promise.all([
    db.select().from(highlights).where(eq(highlights.userId, userId)).orderBy(desc(highlights.createdAt)),
    db.select().from(tags).where(eq(tags.userId, userId)),
  ]);

  const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

  if (format === "json") {
    const data = allHighlights.map((h) => ({
      id: h.id,
      text: h.text,
      sourceUrl: h.sourceUrl,
      pageTitle: h.pageTitle,
      domain: h.domain,
      notes: h.notes,
      tags: (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean),
      metadataTags: JSON.parse(h.metadataTags || "[]"),
      createdAt: h.createdAt,
    }));
    return res.status(200).json({ content: JSON.stringify(data, null, 2), filename: "highlights.json" });
  }

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
      const tagNames = (JSON.parse(h.tagIds || "[]") as number[]).map((id) => tagMap[id]?.name).filter(Boolean);
      md += `> ${h.text}\n\n`;
      md += `**Source:** [${h.pageTitle || h.sourceUrl}](${h.sourceUrl})  \n`;
      md += `**Saved:** ${new Date(h.createdAt).toLocaleDateString()}  \n`;
      if (tagNames.length) md += `**Tags:** ${tagNames.join(", ")}  \n`;
      if (h.notes) md += `**Notes:** ${h.notes}  \n`;
      md += `\n---\n\n`;
    }
  }
  return res.status(200).json({ content: md, filename: "highlights.md" });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/highlights/export.ts
git commit -m "refactor: use shared auth/cors helpers in export handler"
```

---

## Task 7: Update `api/tags/index.ts`

**Files:**
- Modify: `api/tags/index.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const userTags = await db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
    return res.status(200).json(userTags);
  }

  if (req.method === "POST") {
    const { name, color } = req.body ?? {};
    if (!name || typeof name !== "string" || name.length === 0 || name.length > 64)
      return res.status(400).json({ error: "Tag name must be 1-64 characters" });
    const tagColor = color || "#6366f1";
    if (!/^#[0-9a-fA-F]{6}$/.test(tagColor))
      return res.status(400).json({ error: "Color must be a valid hex color (e.g. #6366f1)" });
    const inserted = await db.insert(tags).values({ userId, name, color: tagColor }).returning();
    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/tags/index.ts
git commit -m "refactor: use shared auth/cors helpers in tags handler"
```

---

## Task 8: Update `api/tokens/index.ts`

**Files:**
- Modify: `api/tokens/index.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const tokens = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.createdAt));
    return res.status(200).json(tokens);
  }

  if (req.method === "POST") {
    const { label } = req.body ?? {};
    const rawLabel = typeof label === "string" ? label.trim() : "";
    if (rawLabel.length > 128)
      return res.status(400).json({ error: "Label must be 128 characters or fewer" });
    const tokenLabel = rawLabel || "Chrome Extension";
    const tokenValue = `hc_${nanoid(40)}`;
    const inserted = await db.insert(apiTokens).values({ userId, token: tokenValue, label: tokenLabel }).returning();
    return res.status(201).json(inserted[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/tokens/index.ts
git commit -m "refactor: use shared auth/cors helpers, add label validation in tokens handler"
```

---

## Task 9: Update `api/auth/login.ts`

**Files:**
- Modify: `api/auth/login.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq, or } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 10 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { username, password } = req.body ?? {};

    if (!username || typeof username !== "string" || username.length > 255)
      return res.status(400).json({ error: "Username or email is required" });
    if (!password || typeof password !== "string" || password.length > 1024)
      return res.status(400).json({ error: "Password is required" });

    const trimmedLogin = username.trim().toLowerCase();

    const found = await db
      .select()
      .from(users)
      .where(or(eq(users.username, trimmedLogin), eq(users.email, trimmedLogin)))
      .limit(1);

    if (found.length === 0)
      return res.status(401).json({ error: "Invalid username or password" });

    const user = found[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const existingTokens = await db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .limit(1);

    let apiToken: string;
    if (existingTokens.length === 0) {
      const tokenValue = `hc_${nanoid(40)}`;
      await db.insert(apiTokens).values({ userId: user.id, token: tokenValue, label: "Chrome Extension" });
      apiToken = tokenValue;
    } else {
      apiToken = existingTokens[0].token;
    }

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

- [ ] **Step 2: Commit**

```bash
git add api/auth/login.ts
git commit -m "feat: add rate limiting and CORS to login handler, enforce input length limits"
```

---

## Task 10: Update `api/auth/register.ts`

**Files:**
- Modify: `api/auth/register.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { signJwt, setSessionCookie } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 5 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { username, email, password } = req.body ?? {};

    if (!username || typeof username !== "string" || username.length < 2 || username.length > 64)
      return res.status(400).json({ error: "Username must be 2-64 characters" });
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255)
      return res.status(400).json({ error: "Valid email is required" });
    if (!password || typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    const existingByUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .limit(1);
    if (existingByUsername.length > 0)
      return res.status(409).json({ error: "Username already taken" });

    const existingByEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);
    if (existingByEmail.length > 0)
      return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db
      .insert(users)
      .values({ username: trimmedUsername, email: trimmedEmail, passwordHash })
      .returning({ id: users.id, username: users.username, email: users.email, theme: users.theme });

    const user = inserted[0];
    const tokenValue = `hc_${nanoid(40)}`;
    await db.insert(apiTokens).values({ userId: user.id, token: tokenValue, label: "Chrome Extension" });

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

- [ ] **Step 2: Commit**

```bash
git add api/auth/register.ts
git commit -m "feat: add rate limiting and CORS to register handler"
```

---

## Task 11: Update `api/extension/save.ts`

**Files:**
- Modify: `api/extension/save.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";
import { inferTags } from "../../src/lib/keyword-tags";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 30 });
  if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

  try {
    const { apiToken, text, sourceUrl, pageTitle, domain } = req.body ?? {};

    if (!apiToken || typeof apiToken !== "string")
      return res.status(401).json({ error: "API token is required" });

    const tokenRows = await db.select().from(apiTokens).where(eq(apiTokens.token, apiToken)).limit(1);
    if (tokenRows.length === 0) return res.status(401).json({ error: "Invalid API token" });

    const userId = tokenRows[0].userId;

    if (!text || typeof text !== "string" || text.length === 0)
      return res.status(400).json({ error: "Text is required" });
    if (text.length > 50000)
      return res.status(400).json({ error: "Text exceeds 50,000 character limit" });

    const rawUrl = typeof sourceUrl === "string" ? sourceUrl : "";
    if (rawUrl && !/^https?:\/\//i.test(rawUrl))
      return res.status(400).json({ error: "Source URL must start with http:// or https://" });

    const rawDomain = typeof domain === "string" ? domain : "";
    if (rawDomain.length > 255)
      return res.status(400).json({ error: "Domain must be 255 characters or fewer" });

    const metadataTags = inferTags(text);
    const inserted = await db
      .insert(highlights)
      .values({
        userId,
        text,
        sourceUrl: rawUrl,
        pageTitle: (pageTitle as string) || "",
        domain: rawDomain,
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

- [ ] **Step 2: Commit**

```bash
git add api/extension/save.ts
git commit -m "feat: add rate limiting, CORS, URL and domain validation to extension/save"
```

---

## Task 12: Update `api/extension/recent.ts`

**Files:**
- Modify: `api/extension/recent.ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiToken = req.query.apiToken as string;
  if (!apiToken) return res.status(401).json({ error: "API token is required" });

  const tokenRows = await db.select().from(apiTokens).where(eq(apiTokens.token, apiToken)).limit(1);
  if (tokenRows.length === 0) return res.status(401).json({ error: "Invalid API token" });

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

- [ ] **Step 2: Commit**

```bash
git add api/extension/recent.ts
git commit -m "refactor: add CORS to extension/recent handler"
```

---

## Task 12b: Update `api/tokens/[id].ts`

**Files:**
- Modify: `api/tokens/[id].ts`

- [ ] **Step 1: Replace the file content**

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthUserIdFromVercelReq(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid token ID" });

  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
  return res.status(200).json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add "api/tokens/[id].ts"
git commit -m "refactor: use shared auth/cors helpers in tokens [id] handler"
```

---

## Task 13: Rewrite Tests

**Files:**
- Rewrite: `highlights.test.ts`

This task replaces the entire file. The tests call Vercel handler functions directly. All DB and auth calls are mocked.

- [ ] **Step 1: Write the full test file**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

const mockHighlightRow = {
  id: 1,
  userId: 1,
  text: "The quick brown fox",
  sourceUrl: "https://example.com/article",
  pageTitle: "Example Article",
  domain: "example.com",
  notes: null,
  tagIds: "[]",
  metadataTags: "[]",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Build a fluent chain: .select().from().where().orderBy()...etc all return chainable objects
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "where", "orderBy", "limit", "offset", "returning", "values", "set"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Make the chain thenable so `await db.select()...` resolves to finalValue
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(finalValue).then(resolve);
  return chain;
}

vi.mock("../../src/lib/db", () => ({ db: mockDb }));

// ─── Mock Auth ───────────────────────────────────────────────────────────────

vi.mock("../../src/lib/auth", () => ({
  getAuthUserIdFromVercelReq: vi.fn(async () => 1),
  verifyJwt: vi.fn(async () => ({ userId: 1, username: "testuser" })),
  clearSessionCookie: vi.fn(() => "mp_session=; HttpOnly; Path=/; Max-Age=0"),
  setSessionCookie: vi.fn((t: string) => `mp_session=${t}; HttpOnly`),
  signJwt: vi.fn(async () => "mock.jwt.token"),
}));

// ─── Mock rate-limit (always allow in tests) ─────────────────────────────────

vi.mock("../../src/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// ─── Mock keyword-tags ───────────────────────────────────────────────────────

vi.mock("../../src/lib/keyword-tags", () => ({
  inferTags: vi.fn(() => []),
}));

// ─── Req / Res helpers ───────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "GET",
    headers: { cookie: "mp_session=valid.jwt.token" },
    query: {},
    body: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  const headers: Record<string, string> = {};
  const res = {
    statusCode,
    body,
    headers,
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      body = data;
      res.body = data;
      return res;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
      return res;
    },
    end() { return res; },
  };
  return res;
}

// ─── Import handlers after mocks are set up ──────────────────────────────────

import highlightsHandler from "./api/highlights/index";
import exportHandler from "./api/highlights/export";
import tagsHandler from "./api/tags/index";
import logoutHandler from "./api/auth/logout";
import loginHandler from "./api/auth/login";
import { rateLimit } from "./src/lib/rate-limit";
import { getAuthUserIdFromVercelReq } from "./src/lib/auth";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/highlights — create", () => {
  beforeEach(() => {
    vi.mocked(mockDb.insert).mockReturnValue(makeChain([mockHighlightRow]) as ReturnType<typeof mockDb.insert>);
  });

  it("creates a highlight and returns it", async () => {
    const req = makeReq({ method: "POST", body: { text: "Test highlight", sourceUrl: "https://example.com/page", pageTitle: "Test Page", domain: "example.com" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(201);
  });

  it("rejects empty text with 400", async () => {
    const req = makeReq({ method: "POST", body: { text: "", sourceUrl: "https://example.com", pageTitle: "", domain: "" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/text/i);
  });

  it("rejects sourceUrl without http/https scheme with 400", async () => {
    const req = makeReq({ method: "POST", body: { text: "Some text", sourceUrl: "not-a-url", pageTitle: "", domain: "" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/url/i);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthUserIdFromVercelReq).mockResolvedValueOnce(null);
    const req = makeReq({ method: "POST", body: { text: "Test", sourceUrl: "https://example.com", pageTitle: "", domain: "" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/highlights — list", () => {
  beforeEach(() => {
    vi.mocked(mockDb.select).mockReturnValue(
      makeChain([mockHighlightRow, { ...mockHighlightRow, id: 2, domain: "supabase.com", text: "Row Level Security is important" }]) as ReturnType<typeof mockDb.select>
    );
  });

  it("returns items list", async () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
  });

  it("passes search param to query", async () => {
    const req = makeReq({ method: "GET", query: { search: "supabase" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
  });

  it("returns 200 even when result is empty", async () => {
    vi.mocked(mockDb.select).mockReturnValue(makeChain([]) as ReturnType<typeof mockDb.select>);
    const req = makeReq({ method: "GET", query: { search: "zzznomatch" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/highlights/export", () => {
  beforeEach(() => {
    vi.mocked(mockDb.select).mockReturnValue(
      makeChain([{
        id: 1, userId: 1, text: "Export test highlight", sourceUrl: "https://example.com",
        pageTitle: "Example", domain: "example.com", notes: "A note", tagIds: "[]",
        metadataTags: "[]", createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date(),
      }]) as ReturnType<typeof mockDb.select>
    );
  });

  it("exports JSON with correct structure", async () => {
    const req = makeReq({ method: "GET", query: { format: "json" } });
    const res = makeRes();
    await exportHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    const body = res.body as { filename: string; content: string };
    expect(body.filename).toBe("highlights.json");
    const parsed = JSON.parse(body.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("text");
    expect(parsed[0]).toHaveProperty("sourceUrl");
    expect(parsed[0]).toHaveProperty("tags");
  });

  it("exports Markdown with correct structure", async () => {
    const req = makeReq({ method: "GET", query: { format: "markdown" } });
    const res = makeRes();
    await exportHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    const body = res.body as { filename: string; content: string };
    expect(body.filename).toBe("highlights.md");
    expect(body.content).toContain("# My Mind Palace");
    expect(body.content).toContain("Export test highlight");
    expect(body.content).toContain("A note");
  });
});

describe("POST /api/tags — create", () => {
  beforeEach(() => {
    vi.mocked(mockDb.insert).mockReturnValue(
      makeChain([{ id: 1, userId: 1, name: "Research", color: "#6366f1", createdAt: new Date() }]) as ReturnType<typeof mockDb.insert>
    );
  });

  it("creates a tag with name and color", async () => {
    const req = makeReq({ method: "POST", body: { name: "Research", color: "#6366f1" } });
    const res = makeRes();
    await tagsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(201);
    expect((res.body as { name: string }).name).toBe("Research");
  });

  it("rejects invalid hex color format with 400", async () => {
    const req = makeReq({ method: "POST", body: { name: "Test", color: "red" } });
    const res = makeRes();
    await tagsHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/color/i);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns success", async () => {
    const req = makeReq({ method: "POST" });
    const res = makeRes();
    await logoutHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe("POST /api/auth/login — rate limiting", () => {
  it("returns 429 after exceeding the rate limit", async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({ method: "POST", body: { username: "user", password: "pass" } });
    const res = makeRes();
    await loginHandler(req, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: string }).error).toMatch(/too many/i);
  });
});

describe("CORS headers", () => {
  it("highlights handler sets Access-Control-Allow-Origin", async () => {
    vi.mocked(mockDb.select).mockReturnValue(makeChain([]) as ReturnType<typeof mockDb.select>);
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run highlights.test.ts
```

Expected output: all 16 tests pass, 0 failures.

If you see `Cannot find module` errors, confirm Task 1–3 commits are present and paths match exactly.

- [ ] **Step 3: Commit**

```bash
git add highlights.test.ts
git commit -m "test: rewrite test suite to test Vercel handlers directly, add security tests"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: 16 tests pass, 0 failures.

- [ ] **Step 2: Run the build**

```bash
npx vite build
```

Expected: `✓ built in ...` with no errors.

- [ ] **Step 3: Final commit if anything was missed**

```bash
git status
# commit any unstaged changes with an appropriate message
```
