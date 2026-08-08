import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { newsletterSubscribers } from "../../../db/schema";

const PUBLIC_ORIGIN = "https://parth-oza.github.io";
const LOCAL_ORIGINS = new Set(["http://localhost:3000", "http://localhost:4173"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const allowed = origin === PUBLIC_ORIGIN || origin === requestOrigin || (origin ? LOCAL_ORIGINS.has(origin) : false);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

async function hashAddress(request: Request) {
  const address = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`coordinatez:notes:${address}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== PUBLIC_ORIGIN && origin !== requestOrigin && !LOCAL_ORIGINS.has(origin)) {
    return json(request, { error: "Origin not allowed." }, 403);
  }

  try {
    const payload = (await request.json()) as { email?: unknown; companyWebsite?: unknown };
    if (payload.companyWebsite) return json(request, { accepted: true }, 201);

    const email = typeof payload.email === "string" ? payload.email.trim().slice(0, 180).toLowerCase() : "";
    if (!EMAIL_PATTERN.test(email)) return json(request, { error: "Enter a valid email address." }, 400);

    const db = getDb();
    const [existing] = await db.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)).limit(1);
    if (existing) return json(request, { accepted: true, alreadySubscribed: true });

    const ipHash = await hashAddress(request);
    if (ipHash) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recent] = await db
        .select({ count: sql<number>`count(*)` })
        .from(newsletterSubscribers)
        .where(and(eq(newsletterSubscribers.ipHash, ipHash), gte(newsletterSubscribers.createdAt, oneHourAgo)));
      if ((recent?.count ?? 0) >= 10) return json(request, { error: "Please wait before trying again." }, 429);
    }

    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      ipHash,
      createdAt: new Date(),
    });

    return json(request, { accepted: true }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const migrationMissing = message.includes("no such table") || message.includes("newsletter_subscribers");
    return json(request, { error: migrationMissing ? "Subscriptions are being prepared. Please try again shortly." : "We could not save your email. Please try again." }, 500);
  }
}
