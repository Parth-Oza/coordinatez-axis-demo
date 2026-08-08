import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { projectBriefs } from "../../../db/schema";

const PUBLIC_ORIGIN = "https://parth-oza.github.io";
const LOCAL_ORIGINS = new Set(["http://localhost:3000", "http://localhost:4173"]);
const MAX_BODY_BYTES = 32_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Configuration = {
  product: string;
  finish: string;
  size: string;
  price: number;
  louversOpen: boolean;
  eveningLight: boolean;
  heaters: boolean;
  privacyScreen: boolean;
};

type BriefPayload = {
  name?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
  notes?: string;
  consent?: boolean;
  companyWebsite?: string;
  configuration?: Partial<Configuration>;
};

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

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function hashAddress(request: Request) {
  const address = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`coordinatez:${address}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validConfiguration(value: Partial<Configuration> | undefined): value is Configuration {
  return Boolean(
    value &&
      typeof value.product === "string" &&
      typeof value.finish === "string" &&
      typeof value.size === "string" &&
      typeof value.price === "number" &&
      Number.isFinite(value.price) &&
      typeof value.louversOpen === "boolean" &&
      typeof value.eveningLight === "boolean" &&
      typeof value.heaters === "boolean" &&
      typeof value.privacyScreen === "boolean",
  );
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

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json(request, { error: "Submission is too large." }, 413);

  try {
    const payload = (await request.json()) as BriefPayload;
    if (payload.companyWebsite) return json(request, { accepted: true }, 201);

    const name = clean(payload.name, 100);
    const email = clean(payload.email, 180).toLowerCase();
    const phone = clean(payload.phone, 40);
    const postalCode = clean(payload.postalCode, 20);
    const notes = clean(payload.notes, 2_500);

    if (name.length < 2) return json(request, { error: "Please enter your name." }, 400);
    if (!EMAIL_PATTERN.test(email)) return json(request, { error: "Please enter a valid email." }, 400);
    if (!payload.consent) return json(request, { error: "Please confirm we may contact you." }, 400);
    if (!validConfiguration(payload.configuration)) return json(request, { error: "Configuration details are incomplete." }, 400);

    const db = getDb();
    const ipHash = await hashAddress(request);
    if (ipHash) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const [recent] = await db
        .select({ count: sql<number>`count(*)` })
        .from(projectBriefs)
        .where(and(eq(projectBriefs.ipHash, ipHash), gte(projectBriefs.createdAt, tenMinutesAgo)));
      if ((recent?.count ?? 0) >= 5) return json(request, { error: "Please wait before sending another request." }, 429);
    }

    const id = crypto.randomUUID();
    await db.insert(projectBriefs).values({
      id,
      name,
      email,
      phone: phone || null,
      postalCode: postalCode || null,
      notes: notes || null,
      consent: true,
      configuration: JSON.stringify(payload.configuration),
      ipHash,
      createdAt: new Date(),
    });

    return json(request, { accepted: true, reference: id.slice(0, 8).toUpperCase() }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const migrationMissing = message.includes("no such table") || message.includes("project_briefs");
    return json(
      request,
      { error: migrationMissing ? "The project service is being prepared. Please try again shortly." : "We could not save your request. Please try again." },
      500,
    );
  }
}
