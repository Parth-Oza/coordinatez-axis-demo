import { and, eq, gt, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  coordinatezAuthEvents,
  coordinatezSessions,
  coordinatezUsers,
} from "../../../db/schema";

const COOKIE_NAME = "coordinatez_session";
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 210_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength: number) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function digest(value: string) {
  const output = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(output));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt).buffer, iterations: PASSWORD_ITERATIONS },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 180) : "";
}

export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function validEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 10 && password.length <= 128;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePassword(password, salt);
  return { passwordHash: encodeBase64Url(passwordHash), passwordSalt: encodeBase64Url(salt) };
}

export async function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  try {
    return constantTimeEqual(await derivePassword(password, decodeBase64Url(passwordSalt)), decodeBase64Url(passwordHash));
  } catch {
    return false;
  }
}

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = await digest(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(coordinatezSessions).values({ tokenHash, userId, createdAt, expiresAt });
  return { token, expiresAt };
}

export function sessionCookie(request: Request, token: string, expiresAt: Date) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

export async function revokeRequestSession(request: Request) {
  const token = cookieValue(request);
  if (!token) return;
  await getDb().delete(coordinatezSessions).where(eq(coordinatezSessions.tokenHash, await digest(token)));
}

export async function getAccountUser(request: Request): Promise<AccountUser | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const now = new Date();
  const [session] = await getDb()
    .select({
      id: coordinatezUsers.id,
      name: coordinatezUsers.name,
      email: coordinatezUsers.email,
      createdAt: coordinatezUsers.createdAt,
    })
    .from(coordinatezSessions)
    .innerJoin(coordinatezUsers, eq(coordinatezSessions.userId, coordinatezUsers.id))
    .where(and(eq(coordinatezSessions.tokenHash, await digest(token)), gt(coordinatezSessions.expiresAt, now)))
    .limit(1);
  if (!session) return null;
  return { ...session, createdAt: session.createdAt.toISOString() };
}

async function hashAddress(request: Request) {
  const address = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return digest(`coordinatez:account:${address}`);
}

export async function enforceAuthRateLimit(request: Request, action: "login" | "register") {
  const db = getDb();
  const ipHash = await hashAddress(request);
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(coordinatezAuthEvents)
    .where(and(eq(coordinatezAuthEvents.ipHash, ipHash), eq(coordinatezAuthEvents.action, action), gte(coordinatezAuthEvents.createdAt, windowStart)));
  if ((recent?.count ?? 0) >= (action === "login" ? 12 : 6)) return false;
  await db.insert(coordinatezAuthEvents).values({ id: crypto.randomUUID(), ipHash, action, createdAt: new Date() });
  return true;
}

export function accountJson(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}
