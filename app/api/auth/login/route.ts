import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { coordinatezUsers } from "../../../../db/schema";
import {
  accountJson,
  createSession,
  enforceAuthRateLimit,
  normalizeEmail,
  requestIsSameOrigin,
  sessionCookie,
  validEmail,
  validPassword,
  verifyPassword,
} from "../../_lib/auth";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return accountJson({ error: "Request origin is not allowed." }, 403);
  if (!(await enforceAuthRateLimit(request, "login"))) return accountJson({ error: "Too many attempts. Please try again in 15 minutes." }, 429);

  try {
    const payload = (await request.json()) as { email?: unknown; password?: unknown };
    const email = normalizeEmail(payload.email);
    if (!validEmail(email) || !validPassword(payload.password)) return accountJson({ error: "Email or password is incorrect." }, 401);

    const [user] = await getDb()
      .select()
      .from(coordinatezUsers)
      .where(eq(coordinatezUsers.email, email))
      .limit(1);
    if (!user || !(await verifyPassword(payload.password, user.passwordHash, user.passwordSalt))) {
      return accountJson({ error: "Email or password is incorrect." }, 401);
    }

    const session = await createSession(user.id);
    return accountJson(
      { user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() } },
      200,
      { "Set-Cookie": sessionCookie(request, session.token, session.expiresAt) },
    );
  } catch {
    return accountJson({ error: "We could not sign you in. Please try again." }, 500);
  }
}
