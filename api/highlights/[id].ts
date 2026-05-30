import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const userId = await getAuthUserIdFromVercelReq(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    let id = Number(req.query.id);
    if (!id || isNaN(id)) {
      // Fallback: extract from URL manually in case Vercel rewrites stripped the path segment mapping
      const pathPart = req.url?.split('?')[0].split('/').pop();
      id = Number(pathPart);
    }
    
    if (!id || isNaN(id)) return res.status(400).json({ error: `Invalid highlight ID: ${req.url}` });

    if (req.method === "GET") {
      const existing = await db
        .select()
        .from(highlights)
        .where(and(eq(highlights.id, id), eq(highlights.userId, userId)))
        .limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "Highlight not found" });
      return res.status(200).json(existing[0]);
    }

    if (req.method === "PATCH") {
      const { notes, tagIds, text } = req.body ?? {};
      if (notes !== undefined && (typeof notes !== "string" || notes.length > 100000)) {
        return res.status(400).json({ error: "Notes must be a string of 100,000 characters or fewer" });
      }
      if (text !== undefined && (typeof text !== "string" || text.length === 0 || text.length > 50000)) {
        return res.status(400).json({ error: "Text must be a valid string of 50,000 characters or fewer" });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (notes !== undefined) updateData.notes = notes;
      if (text !== undefined) updateData.text = text;
      if (tagIds !== undefined) {
        if (!Array.isArray(tagIds) || !tagIds.every((t) => typeof t === "number" && Number.isInteger(t) && t > 0)) {
          return res.status(400).json({ error: "tagIds must be an array of positive integers" });
        }
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
  } catch (err: unknown) {
    console.error("[highlights/id] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
