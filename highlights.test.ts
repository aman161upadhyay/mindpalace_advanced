import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Hoisted mocks (available inside vi.mock factories) ──────────────────────

const { mockDb, mockGetAuthUserId, mockRateLimit, mockGetClientIp } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mockGetAuthUserId: vi.fn(),
    mockRateLimit: vi.fn(),
    mockGetClientIp: vi.fn(),
  };
});

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeChain(resolveWith: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "limit", "offset", "returning", "values", "set", "then", "catch", "finally"]) {
    chain[m] = vi.fn((..._args: unknown[]) => chain);
  }
  (chain as Promise<unknown>).then = (onFulfilled?: ((value: unknown) => unknown) | null) =>
    Promise.resolve(resolveWith).then(onFulfilled ?? undefined);
  return chain;
}

// ─── vi.mock calls ───────────────────────────────────────────────────────────

vi.mock("./src/lib/db", () => ({ db: mockDb }));

vi.mock("./src/lib/auth", () => ({
  getAuthUserIdFromVercelReq: mockGetAuthUserId,
  clearSessionCookie: vi.fn(() => "mp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"),
  verifyJwt: vi.fn(),
  signJwt: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("./src/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getClientIp: mockGetClientIp,
}));

vi.mock("./src/lib/keyword-tags", () => ({
  inferTags: vi.fn(() => []),
}));

vi.mock("./src/lib/cors", () => ({
  applyCors: vi.fn((_req: unknown, res: { setHeader: (k: string, v: string) => void; status: (c: number) => { end: () => void }; method?: string }) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return false;
  }),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import highlightsHandler from "./api/highlights/index";
import exportHandler from "./api/highlights/export";
import tagsHandler from "./api/tags/index";
import logoutHandler from "./api/auth/logout";
import loginHandler from "./api/auth/login";

// ─── Request / Response helpers ──────────────────────────────────────────────

function makeReq(overrides: Partial<Record<string, unknown>> = {}): VercelRequest {
  return {
    method: "GET",
    headers: { cookie: "mp_session=valid.jwt.token" },
    query: {},
    body: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  let statusCode = 200;
  let body: unknown = null;
  const headers: Record<string, string> = {};
  const res = {
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return headers; },
    status(code: number) { statusCode = code; return res; },
    json(data: unknown) { body = data; return res; },
    setHeader(key: string, value: string) { headers[key] = value; return res; },
    end() { return res; },
  };
  return res;
}

// ─── Default mock setup ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthUserId.mockResolvedValue(1);
  mockRateLimit.mockReturnValue({ allowed: true, remaining: 9 });
  mockGetClientIp.mockReturnValue("127.0.0.1");

  // Default: select returns empty array, insert returns a row
  mockDb.select.mockReturnValue(makeChain([]));
  mockDb.insert.mockReturnValue(makeChain([]));
  mockDb.update.mockReturnValue(makeChain([]));
  mockDb.delete.mockReturnValue(makeChain([]));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("highlights.create (POST /api/highlights)", () => {
  it("1. creates a highlight and returns 201", async () => {
    const insertedRow = {
      id: 1, userId: 1, text: "Test highlight", sourceUrl: "https://example.com/page",
      pageTitle: "Test Page", domain: "example.com", notes: null, tagIds: "[]",
      metadataTags: "[]", createdAt: new Date(), updatedAt: new Date(),
    };
    mockDb.insert.mockReturnValue(makeChain([insertedRow]));

    const req = makeReq({ method: "POST", body: { text: "Test highlight", sourceUrl: "https://example.com/page", pageTitle: "Test Page", domain: "example.com" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(201);
    expect((res.body as Record<string, unknown>).text).toBe("Test highlight");
  });

  it("2. rejects empty text with 400", async () => {
    const req = makeReq({ method: "POST", body: { text: "", sourceUrl: "https://example.com" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain("text");
  });

  it("3. rejects sourceUrl without http/https with 400", async () => {
    const req = makeReq({ method: "POST", body: { text: "Some text", sourceUrl: "not-a-url" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain("url");
  });

  it("4. returns 401 when unauthenticated", async () => {
    mockGetAuthUserId.mockResolvedValue(null);
    const req = makeReq({ method: "POST", body: { text: "Test", sourceUrl: "https://example.com" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(401);
  });
});

describe("highlights.list (GET /api/highlights)", () => {
  it("5. returns 200 with items", async () => {
    const items = [
      { id: 1, userId: 1, text: "Highlight 1", sourceUrl: "https://example.com", pageTitle: "Ex", domain: "example.com", notes: null, tagIds: "[]", metadataTags: "[]", createdAt: new Date(), updatedAt: new Date() },
    ];
    // GET handler calls db.select() twice via Promise.all: items + count
    mockDb.select
      .mockReturnValueOnce(makeChain(items))
      .mockReturnValueOnce(makeChain([{ count: 1 }]));

    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect((res.body as Record<string, unknown>).items).toEqual(items);
  });

  it("6. passes search param and returns 200", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ count: 0 }]));

    const req = makeReq({ method: "GET", query: { search: "supabase" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
  });

  it("7. returns 200 even when result is empty", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ count: 0 }]));

    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect((res.body as Record<string, unknown>).items).toEqual([]);
    expect((res.body as Record<string, unknown>).total).toBe(0);
  });
});

describe("highlights.export", () => {
  it("8. GET ?format=json returns 200 with correct filename and JSON content", async () => {
    const exportHighlights = [
      { id: 1, userId: 1, text: "Export test highlight", sourceUrl: "https://example.com", pageTitle: "Example", domain: "example.com", notes: "A note", tagIds: "[]", metadataTags: "[]", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
    ];
    // export handler calls db.select() twice via Promise.all: highlights + tags
    mockDb.select
      .mockReturnValueOnce(makeChain(exportHighlights))
      .mockReturnValueOnce(makeChain([]));

    const req = makeReq({ method: "GET", query: { format: "json" } });
    const res = makeRes();
    await exportHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.filename).toBe("highlights.json");
    const parsed = JSON.parse(body.content as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("text");
    expect(parsed[0]).toHaveProperty("sourceUrl");
    expect(parsed[0]).toHaveProperty("tags");
  });

  it("9. GET ?format=markdown returns 200 with correct filename and Markdown content", async () => {
    const exportHighlights = [
      { id: 1, userId: 1, text: "Export test highlight", sourceUrl: "https://example.com", pageTitle: "Example", domain: "example.com", notes: "A note", tagIds: "[]", metadataTags: "[]", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") },
    ];
    mockDb.select
      .mockReturnValueOnce(makeChain(exportHighlights))
      .mockReturnValueOnce(makeChain([]));

    const req = makeReq({ method: "GET", query: { format: "markdown" } });
    const res = makeRes();
    await exportHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.filename).toBe("highlights.md");
    expect(body.content).toContain("# My Mind Palace");
    expect(body.content).toContain("Export test highlight");
    expect(body.content).toContain("A note");
  });
});

describe("tags.create (POST /api/tags)", () => {
  it("10. creates a tag and returns 201", async () => {
    const insertedTag = { id: 1, userId: 1, name: "Research", color: "#6366f1", createdAt: new Date() };
    mockDb.insert.mockReturnValue(makeChain([insertedTag]));

    const req = makeReq({ method: "POST", body: { name: "Research", color: "#6366f1" } });
    const res = makeRes();
    await tagsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(201);
    expect((res.body as Record<string, unknown>).name).toBe("Research");
  });

  it("11. rejects invalid hex color 'red' with 400", async () => {
    const req = makeReq({ method: "POST", body: { name: "Test", color: "red" } });
    const res = makeRes();
    await tagsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain("color");
  });
});

describe("auth.logout (POST /api/auth/logout)", () => {
  it("12. returns 200 with { success: true }", async () => {
    const req = makeReq({ method: "POST" });
    const res = makeRes();
    await logoutHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe("rate limiting", () => {
  it("13. POST /api/auth/login returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

    const req = makeReq({ method: "POST", body: { username: "test", password: "pass" } });
    const res = makeRes();
    await loginHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(429);
  });
});

describe("CORS", () => {
  it("14. GET /api/highlights response has Access-Control-Allow-Origin header", async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ count: 0 }]));

    const req = makeReq({ method: "GET" });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.headers["Access-Control-Allow-Origin"]).toBeDefined();
  });
});

describe("additional security tests", () => {
  it("15. POST /api/highlights with text exceeding 50000 chars returns 400", async () => {
    const longText = "a".repeat(50001);
    const req = makeReq({ method: "POST", body: { text: longText, sourceUrl: "https://example.com" } });
    const res = makeRes();
    await highlightsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
  });

  it("16. POST /api/tags with empty name returns 400", async () => {
    const req = makeReq({ method: "POST", body: { name: "", color: "#6366f1" } });
    const res = makeRes();
    await tagsHandler(req, res as unknown as VercelResponse);

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain("name");
  });
});
