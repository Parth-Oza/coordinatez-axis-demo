import { accountJson, clearSessionCookie, requestIsSameOrigin, revokeRequestSession } from "../../_lib/auth";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return accountJson({ error: "Request origin is not allowed." }, 403);
  try {
    await revokeRequestSession(request);
  } catch {
    // Clearing the browser cookie still signs the visitor out if storage is temporarily unavailable.
  }
  return accountJson({ signedOut: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
