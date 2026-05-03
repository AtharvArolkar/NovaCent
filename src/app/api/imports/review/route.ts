import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { reviewImportRowsForAccount } from "@/lib/server/import-review";
import { getDb } from "@/lib/server/mongodb";
import { importBulkReviewSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const { accountId, account, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = importBulkReviewSchema.parse(await request.json());
    const db = await getDb();
    const result = await reviewImportRowsForAccount(db, {
      accountId,
      accountBaseCurrency: account.baseCurrency,
      userId: user.id,
      rows: payload.rows
    });

    if (result.missingBatchIds.length) {
      return problem("One or more import batches were not found.", 404, { missingBatchIds: result.missingBatchIds });
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
