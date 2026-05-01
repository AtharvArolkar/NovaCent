import { handleApiError, ok, problem } from "@/lib/server/http";
import { runDueRecurringExpenses } from "@/lib/server/recurring-expenses";

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      return problem("Cron request is not authorized.", 401);
    }

    const result = await runDueRecurringExpenses();
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
