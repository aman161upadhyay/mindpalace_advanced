import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users, highlights } from "../../src/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

// Vercel Cron security: only allow requests from Vercel's scheduler
function verifyCronSecret(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers["authorization"] === `Bearer ${secret}`;
}

function buildEmailHtml(username: string, items: any[]): string {
  const highlightCards = items
    .map(
      (h) => `
    <div style="margin-bottom:20px;padding:16px 20px;background:#f8f7f4;border-left:3px solid #6366f1;border-radius:6px;">
      <p style="margin:0 0 8px;font-style:italic;color:#1a1a2e;line-height:1.6;font-size:15px;">
        "${h.text}"
      </p>
      <p style="margin:0;font-size:12px;color:#666;">
        ${h.pageTitle ? `<span>${h.pageTitle}</span>` : ""}
        ${h.domain ? `<span style="color:#999;"> · ${h.domain}</span>` : ""}
      </p>
      ${h.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#555;background:#fff;padding:8px 12px;border-radius:4px;">📝 ${h.notes}</p>` : ""}
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0efe9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;font-size:22px;color:#1a1a2e;font-weight:600;">✦ Your Daily Highlights</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#888;">A curated selection from your Mind Palace</p>
    </div>

    <p style="font-size:14px;color:#444;margin:0 0 20px;">
      Good morning, <strong>${username}</strong>. Here are 5 highlights from your collection to revisit today:
    </p>

    ${highlightCards}

    <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid #ddd;">
      <p style="font-size:12px;color:#999;margin:0;">
        Sent from <a href="${process.env.DASHBOARD_URL || 'https://mindpalace-bice.vercel.app'}" style="color:#6366f1;text-decoration:none;">Mind Palace</a>.
        You can disable daily emails in your <a href="${process.env.DASHBOARD_URL || 'https://mindpalace-bice.vercel.app'}/settings" style="color:#6366f1;text-decoration:none;">Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyCronSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  try {
    // 1. Fetch all users who have daily email enabled
    const eligibleUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(eq(users.dailyEmailEnabled, true));

    if (eligibleUsers.length === 0) {
      return res.status(200).json({ message: "No users opted in", sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // 2. For each user, get 5 random highlights and send email
    for (const user of eligibleUsers) {
      const randomHighlights = await db
        .select()
        .from(highlights)
        .where(eq(highlights.userId, user.id))
        .orderBy(sql`RANDOM()`)
        .limit(5);

      // Skip users with fewer than 1 highlight
      if (randomHighlights.length === 0) continue;

      const emailHtml = buildEmailHtml(user.username, randomHighlights);

      try {
        await resend.emails.send({
          from: "Mind Palace <onboarding@resend.dev>",
          to: user.email,
          subject: `✦ Your Daily Highlights — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          html: emailHtml,
        });
        sentCount++;
      } catch (emailErr: any) {
        console.error(`[cron] Failed to send to ${user.email}:`, emailErr);
        errors.push(`${user.email}: ${emailErr.message}`);
      }
    }

    return res.status(200).json({
      message: `Daily highlights sent`,
      sent: sentCount,
      total: eligibleUsers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[cron] daily-highlights error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
