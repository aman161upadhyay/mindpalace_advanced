import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { apiTokens, highlights } from "../../src/schema";
import { applyCors } from "../../src/lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const apiToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
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
  } catch (err: unknown) {
    console.error("[extension/recent] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
