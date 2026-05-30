import { SignJWT, jwtVerify } from "jose";
import type { VercelRequest } from "@vercel/node";

interface JwtPayload {
  userId: number;
  username: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId === "number" &&
      typeof payload.username === "string"
    ) {
      return { userId: payload.userId, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

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

export async function requireAuth(req: Request): Promise<JwtPayload> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["hc_session"];

  if (!token) {
    throw new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    throw new Response(JSON.stringify({ error: "Invalid or expired session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return payload;
}

export function setSessionCookie(token: string): string {
  const maxAge = 30 * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `hc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `hc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function getAuthUserIdFromVercelReq(req: VercelRequest): Promise<number | null> {
  const cookieHeader = (req.headers.cookie as string) ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    const k = key?.trim();
    if (k) cookies[k] = decodeURIComponent(rest.join("=").trim());
  }
  const token = cookies["hc_session"];
  if (!token) return null;
  const payload = await verifyJwt(token);
  return payload?.userId ?? null;
}
