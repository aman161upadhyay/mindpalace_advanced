import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users } from "../../src/schema";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Strict rate limiting to prevent brute-force attempts
  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 5 });
  if (!allowed) return res.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });

  try {
    const { username, email, newPassword } = req.body ?? {};

    if (!username || typeof username !== "string" || username.length > 255)
      return res.status(400).json({ error: "Username is required" });
    if (!email || typeof email !== "string" || email.length > 255)
      return res.status(400).json({ error: "Email is required" });
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 1024)
      return res.status(400).json({ error: "New password must be at least 8 characters" });

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    // Find user by both username AND email — identity verification
    const found = await db
      .select()
      .from(users)
      .where(and(eq(users.username, trimmedUsername), eq(users.email, trimmedEmail)))
      .limit(1);

    if (found.length === 0) {
      return res.status(400).json({ error: "Invalid credentials — please check your username and email" });
    }

    const user = found[0];
    const newHash = await bcrypt.hash(newPassword, 12);

    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return res.status(200).json({ success: true, message: "Password has been reset. You can now sign in." });
  } catch (err: unknown) {
    console.error("[reset-password] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
