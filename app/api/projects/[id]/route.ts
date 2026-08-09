import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { coordinatezProjects } from "../../../../db/schema";
import { accountJson, getAccountUser, requestIsSameOrigin } from "../../_lib/auth";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requestIsSameOrigin(request)) return accountJson({ error: "Request origin is not allowed." }, 403);
  try {
    const user = await getAccountUser(request);
    if (!user) return accountJson({ error: "Sign in to manage projects." }, 401);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return accountJson({ error: "Project not found." }, 404);
    await getDb().delete(coordinatezProjects).where(and(eq(coordinatezProjects.id, id), eq(coordinatezProjects.userId, user.id)));
    return accountJson({ deleted: true });
  } catch {
    return accountJson({ error: "We could not remove this project." }, 500);
  }
}
