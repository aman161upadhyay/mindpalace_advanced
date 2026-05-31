// Generates a short-lived OAuth2 access token from a GCP service account JSON key.
// Uses the jose library (already in package.json) to sign the JWT.

import { SignJWT, importPKCS8 } from "jose";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getVertexAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");

  // Vercel mangles env vars: converts \n to real newlines, corrupts some escapes.
  // Fix: strip newlines, remove invalid backslash escapes, parse JSON.
  const cleaned = raw
    .replace(/[\n\r]/g, "")
    .replace(/\\(?!["\\\/bfnrtu])/g, "");
  const key: ServiceAccountKey = JSON.parse(cleaned);
  // Reconstruct clean PEM: extract base64, strip any non-base64 chars (spaces etc),
  // then wrap with proper PEM markers. importPKCS8 handles single-line base64.
  const pemMatch = key.private_key.match(
    /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END [A-Z ]+-----/
  );
  if (pemMatch) {
    const base64 = pemMatch[2].replace(/[^A-Za-z0-9+/=]/g, "");
    key.private_key = `-----BEGIN ${pemMatch[1]}-----\n${base64}\n-----END ${pemMatch[1]}-----\n`;
  }
  const now = Math.floor(Date.now() / 1000);

  // Sign a JWT assertion for the Google OAuth2 token endpoint
  const privateKey = await importPKCS8(key.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(key.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  // Exchange JWT assertion for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get Vertex AI token: ${err}`);
  }

  const data = await tokenRes.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const token = await getVertexAccessToken();
  const project = "agentlanggraph";
  const location = "global";
  const model = "gemini-3.1-flash-lite";

  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text in Gemini response");
  return text;
}
