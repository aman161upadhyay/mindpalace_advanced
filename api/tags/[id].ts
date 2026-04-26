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
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["mp_session"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const payload = await verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid session" });

  const id = Number(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid tag ID" });

  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, payload.userId)));
  return res.status(200).json({ success: true });
}
