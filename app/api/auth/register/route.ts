import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { coordinatezUsers } from "../../../../db/schema";
import {
  accountJson,
  cleanName,
  createSession,
  enforceAuthRateLimit,
  hashPassword,
  normalizeEmail,
  requestIsSameOrigin,
  sessionCookie,
  validEmail,
  validPassword,
} from "../../_lib/auth";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return accountJson({ error: "Request origin is not allowed." }, 403);
  if (!(await enforceAuthRateLimit(request, "register"))) return accountJson({ error: "Too many attempts. Please try again in 15 minutes." }, 429);

  try {
    const payload = (await request.json()) as { name?: unknown; email?: unknown; password?: unknown };
    const name = cleanName(payload.name);
    const email = normalizeEmail(payload.email);
    if (name.length < 2) return accountJson({ error: "Enter your full name." }, 400);
    if (!validEmail(email)) return accountJson({ error: "Enter a valid email address." }, 400);
    if (!validPassword(payload.password)) return accountJson({ error: "Use at least 10 characters for your password." }, 400);

    const db = getDb();
    const [existing] = await db.select({ id: coordinatezUsers.id }).from(coordinatezUsers).where(eq(coordinatezUsers.email, email)).limit(1);
    if (existing) return accountJson({ error: "An account already exists for this email." }, 409);

    const userId = crypto.randomUUID();
    const password = await hashPassword(payload.password);
    const createdAt = new Date();
    await db.insert(coordinatezUsers).values({ id: userId, name, email, ...password, createdAt });
    const session = await createSession(userId);
    return accountJson(
      { user: { id: userId, name, email, createdAt: createdAt.toISOString() } },
      201,
      { "Set-Cookie": sessionCookie(request, session.token, session.expiresAt) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) return accountJson({ error: "An account already exists for this email." }, 409);
    return accountJson({ error: "We could not create the account. Please try again." }, 500);
  }
}
