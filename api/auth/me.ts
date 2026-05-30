import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, apiTokens } from "../../src/schema";
import { verifyJwt } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";

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
  if (applyCors(req, res)) return;
  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["hc_session"];

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
        dailyEmailEnabled: users.dailyEmailEnabled,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (found.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const tokenRows = await db
      .select({ token: apiTokens.token })
      .from(apiTokens)
      .where(eq(apiTokens.userId, payload.userId))
      .limit(1);

    return res.status(200).json({
      ...found[0],
      apiToken: tokenRows[0]?.token ?? null,
    });
  }

  if (req.method === "PATCH") {
    const { theme, dailyEmailEnabled } = req.body ?? {};

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (theme !== undefined) {
      if (theme !== "dark" && theme !== "light") {
        return res.status(400).json({ error: "Theme must be 'dark' or 'light'" });
      }
      updates.theme = theme;
    }

    if (dailyEmailEnabled !== undefined) {
      if (typeof dailyEmailEnabled !== "boolean") {
        return res.status(400).json({ error: "dailyEmailEnabled must be a boolean" });
      }
      updates.dailyEmailEnabled = dailyEmailEnabled;
    }

    if (Object.keys(updates).length > 1) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, payload.userId));
    }

    const found = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        theme: users.theme,
        dailyEmailEnabled: users.dailyEmailEnabled,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    return res.status(200).json(found[0]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
