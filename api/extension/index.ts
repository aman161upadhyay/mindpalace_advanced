import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, apiTokens, tags } from "../../src/schema";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";
import { inferTags } from "../../src/lib/keyword-tags";

async function getUserIdFromToken(token: string): Promise<number | null> {
  if (!token) return null;
  const found = await db
    .select({ userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.token, token))
    .limit(1);
  return found[0]?.userId ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  // GET /api/extension?apiToken=xxx — return 10 recent highlights
  if (req.method === "GET") {
    const apiToken = (req.query.apiToken as string) || "";
    const userId = await getUserIdFromToken(apiToken);
    if (!userId) return res.status(401).json({ error: "Invalid API token" });

    const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
    const tagMap = Object.fromEntries(allTags.map((t) => [t.id, t]));

    const items = await db
      .select()
      .from(highlights)
      .where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt)))
      .orderBy(desc(highlights.createdAt))
      .limit(10);

    return res.status(200).json(
      items.map((h) => ({
        id: h.id,
        text: h.text,
        sourceUrl: h.sourceUrl,
        pageTitle: h.pageTitle,
        domain: h.domain,
        tags: (JSON.parse(h.tagIds || "[]") as number[])
          .map((id) => tagMap[id]?.name)
          .filter(Boolean),
        createdAt: h.createdAt,
      }))
    );
  }

  // POST /api/extension — save a highlight from the extension
  if (req.method === "POST") {
    const ip = getClientIp(req.headers);
    const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 30 });
    if (!allowed) return res.status(429).json({ error: "Too many requests, please try again later" });

    const { apiToken, text, sourceUrl, pageTitle, domain } = req.body ?? {};
    const userId = await getUserIdFromToken(apiToken);
    if (!userId) return res.status(401).json({ error: "Invalid API token" });

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
