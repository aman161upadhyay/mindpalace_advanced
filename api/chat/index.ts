import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { highlights, tags } from "../../src/schema";
import { getAuthUserIdFromVercelReq } from "../../src/lib/auth";
import { applyCors } from "../../src/lib/cors";
import { rateLimit, getClientIp } from "../../src/lib/rate-limit";
import { callGemini } from "../../src/lib/vertex";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req.headers);
  const { allowed } = rateLimit(ip, { windowMs: 60_000, max: 20 });
  if (!allowed) return res.status(429).json({ error: "Too many requests. Please wait a moment." });

  try {
    const userId = await getAuthUserIdFromVercelReq(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { question } = req.body ?? {};
    if (!question || typeof question !== "string" || question.trim().length === 0)
      return res.status(400).json({ error: "Question is required" });
    if (question.length > 2000)
      return res.status(400).json({ error: "Question is too long (max 2000 characters)" });

    // Fetch up to 300 highlights and all tags for context
    const [userHighlights, userTags] = await Promise.all([
      db
        .select()
        .from(highlights)
        .where(and(eq(highlights.userId, userId), isNull(highlights.deletedAt)))
        .orderBy(desc(highlights.createdAt))
        .limit(300),
      db.select().from(tags).where(eq(tags.userId, userId)),
    ]);

    const tagMap = Object.fromEntries(userTags.map((t) => [t.id, t.name]));

    // Build highlight context — compact format to stay within token budget
    const contextLines = userHighlights.map((h, i) => {
      const tagNames = (JSON.parse(h.tagIds || "[]") as number[])
        .map((id) => tagMap[id])
        .filter(Boolean)
        .join(", ");
      const metaTags = (JSON.parse(h.metadataTags || "[]") as string[]).join(", ");
      const allTags = [tagNames, metaTags].filter(Boolean).join(", ");
      return [
        `[${i + 1}] Source: ${h.domain || h.sourceUrl}`,
        `Text: ${h.text.slice(0, 800)}${h.text.length > 800 ? "…" : ""}`,
        allTags ? `Tags: ${allTags}` : null,
        h.notes ? `Notes: ${h.notes.slice(0, 200)}` : null,
        `Saved: ${new Date(h.createdAt).toLocaleDateString()}`,
      ]
        .filter(Boolean)
        .join("\n");
    });

    const highlightContext =
      contextLines.length > 0
        ? contextLines.join("\n\n---\n\n")
        : "No highlights saved yet.";

    const systemInstruction = `You are the user's Mind Palace assistant — a knowledgeable, concise AI that helps them explore and connect ideas from their personal highlight collection.

The user has saved ${userHighlights.length} highlights from various sources. Each highlight includes the captured text, its source, any tags they applied, and optional personal notes.

RULES:
- Answer only based on the highlights provided. Do not make up information.
- Be specific: quote or paraphrase relevant highlights when answering.
- If no highlights are relevant to the question, say so clearly.
- Keep answers concise — 3-5 sentences unless a longer answer is clearly needed.
- Do not mention highlight numbers in your answer; refer to content and sources naturally.

HIGHLIGHTS:
${highlightContext}`;

    const answer = await callGemini(question.trim(), systemInstruction);
    return res.status(200).json({ answer });
  } catch (err: unknown) {
    console.error("[chat] Error:", err);
    return res.status(500).json({ error: "Failed to generate answer. Please try again." });
  }
}
