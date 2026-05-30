import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
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
      .values({ username: trimmedUsername, email: trimmedEmail, passwordHash, dailyEmailEnabled: false })
      .returning({ id: users.id, username: users.username, email: users.email, theme: users.theme });

    const user = inserted[0];
    const tokenValue = `hc_${randomBytes(20).toString("hex")}`;
    await db.insert(apiTokens).values({ userId: user.id, token: tokenValue, label: "Chrome Extension" });

    const jwt = await signJwt({ userId: user.id, username: user.username });
    res.setHeader("Set-Cookie", setSessionCookie(jwt));
    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email, theme: user.theme },
      apiToken: tokenValue,
    });
  } catch (err: unknown) {
    // Handle unique constraint violations (race condition between check and insert)
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505")) {
      return res.status(409).json({ error: "Username or email already taken" });
    }
    console.error("[register] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
