import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../../src/lib/db";
import { apiTokens } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
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
      const tokenValue = `hc_${randomBytes(20).toString("hex")}`;
      const inserted = await db.insert(apiTokens).values({ userId, token: tokenValue, label: tokenLabel }).returning();
      return res.status(201).json(inserted[0]);
    }

    if (req.method === "DELETE") {
      const id = Number(req.query.id);
      if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid token ID" });
      await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: unknown) {
    console.error("[tokens] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
