import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { coordinatezProjects } from "../../../db/schema";
import { accountJson, getAccountUser, requestIsSameOrigin } from "../_lib/auth";

function cleanProjectName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 100) : "";
}

export async function GET(request: Request) {
  try {
    const user = await getAccountUser(request);
    if (!user) return accountJson({ error: "Sign in to view saved projects." }, 401);
    const projects = await getDb()
      .select()
      .from(coordinatezProjects)
      .where(eq(coordinatezProjects.userId, user.id))
      .orderBy(desc(coordinatezProjects.updatedAt))
      .limit(50);
    return accountJson({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        configuration: JSON.parse(project.configuration) as unknown,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      })),
    });
  } catch {
    return accountJson({ error: "We could not load your projects." }, 500);
  }
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) return accountJson({ error: "Request origin is not allowed." }, 403);
  try {
    const user = await getAccountUser(request);
    if (!user) return accountJson({ error: "Sign in to save projects to your account." }, 401);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 32_000) return accountJson({ error: "This project is too large to save." }, 413);

    const payload = (await request.json()) as { name?: unknown; configuration?: unknown };
    const name = cleanProjectName(payload.name);
    if (name.length < 2) return accountJson({ error: "Add a project name." }, 400);
    if (!payload.configuration || typeof payload.configuration !== "object" || Array.isArray(payload.configuration)) {
      return accountJson({ error: "The configuration is incomplete." }, 400);
    }
    const configuration = JSON.stringify(payload.configuration);
    if (configuration.length > 24_000) return accountJson({ error: "This configuration is too large to save." }, 413);

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb().insert(coordinatezProjects).values({ id, userId: user.id, name, configuration, createdAt: now, updatedAt: now });
    return accountJson({ project: { id, name, configuration: payload.configuration, createdAt: now.toISOString(), updatedAt: now.toISOString() } }, 201);
  } catch {
    return accountJson({ error: "We could not save this project." }, 500);
  }
}
