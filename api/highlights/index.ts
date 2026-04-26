import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { inferTags } from "../../src/lib/keyword-tags";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const userId = await getAuthUserIdFromVercelReq(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const action = (req.query.action as string) || "";

    // ── GET ?action=stats ──────────────────────────────────────────────────
    if (req.method === "GET" && action === "stats") {
      const stats = await db
        .select({ domain: highlights.domain, count: sql<number>`count(*)` })
        .from(highlights)
        .where(eq(highlights.userId, userId))
        .groupBy(highlights.domain)
        .orderBy(desc(sql`count(*)`))
        .limit(20);
      return res.status(200).json(stats);
    }

    // ── GET ?action=export&format=json|markdown ────────────────────────────
    if (req.method === "GET" && action === "export") {
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

    // ── GET (list with search/filter/pagination) ───────────────────────────
    if (req.method === "GET") {
      const search = (req.query.search as string) || "";
      const tagId = req.query.tagId ? Number(req.query.tagId) : undefined;
      const domain = (req.query.domain as string) || "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = 30;
      const offset = (page - 1) * limit;

      const conditions = [eq(highlights.userId, userId)];

      if (search) {
        const escapedSearch = search.replace(/[%_\\]/g, (c) => `\\${c}`);
        const pattern = `%${escapedSearch}%`;
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

    // ── POST (create) ──────────────────────────────────────────────────────
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
  } catch (err: unknown) {
    console.error("[highlights/index] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
