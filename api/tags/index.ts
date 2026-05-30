import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { tags, highlights } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
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

    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid tag ID" });

      const deleted = await db
        .delete(tags)
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning();

      if (deleted.length > 0) {
        const highlightsToUpdate = await db
          .select({ id: highlights.id, tagIds: highlights.tagIds })
          .from(highlights)
          .where(
            and(
              eq(highlights.userId, userId),
              or(
                like(highlights.tagIds, `[${id}]`),
                like(highlights.tagIds, `[${id},%`),
                like(highlights.tagIds, `%,${id}]`),
                like(highlights.tagIds, `%,${id},%`)
              )
            )
          );

        for (const h of highlightsToUpdate) {
          try {
            const tagIds = JSON.parse(h.tagIds || "[]");
            if (Array.isArray(tagIds) && tagIds.includes(id)) {
              const updatedTagIds = tagIds.filter((tid: number) => tid !== id);
              await db
                .update(highlights)
                .set({ tagIds: JSON.stringify(updatedTagIds) })
                .where(eq(highlights.id, h.id));
            }
          } catch (e) {
            console.error(`Failed to cleanup tag ${id} from highlight ${h.id}:`, e);
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("[tags] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
