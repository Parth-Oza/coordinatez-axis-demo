import { accountJson, getAccountUser } from "../../_lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getAccountUser(request);
    return accountJson({ user });
  } catch {
    return accountJson({ user: null });
  }
}
