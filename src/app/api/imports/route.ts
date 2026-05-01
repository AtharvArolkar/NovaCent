import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { parseStatementFile } from "@/lib/server/import-parser";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { markPossibleImportDuplicates } from "@/lib/server/import-duplicates";
import { createNotification } from "@/lib/server/notifications";
import type { CategoryRule } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const url = new URL(request.url);
    const duplicateOnly = url.searchParams.get("duplicates") === "true";
    const status = url.searchParams.get("status");
    const batches = await db.collection(collections.importBatches).find({ accountId }).sort({ createdAt: -1 }).limit(50).toArray();

    if (duplicateOnly || status) {
      return ok({
        batches: batches.map((batch) => ({
          ...batch,
          rows: (batch.rows ?? []).filter((row: { status?: string; possibleDuplicates?: unknown[] }) => {
            if (duplicateOnly && (!row.possibleDuplicates || row.possibleDuplicates.length === 0)) {
              return false;
            }
            return status ? row.status === status : true;
          })
        }))
      });
    }

    return ok({ batches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return problem("A statement file is required.", 400);
    }

    const db = await getDb();
    const batchId = crypto.randomUUID();
    const rules = await db.collection<CategoryRule>(collections.categoryRules).find({ accountId }).toArray();
    const parsedRows = await parseStatementFile(file, batchId, rules);
    const rows = await markPossibleImportDuplicates(accountId, parsedRows);
    const now = new Date().toISOString();
    const batch = {
      id: batchId,
      accountId,
      fileName: file.name,
      status: "review",
      rows,
      createdAt: now,
      updatedAt: now,
      originalFileDeleted: true
    };

    await db.collection(collections.importBatches).insertOne(batch);
    if (rows.length) {
      await db.collection(collections.importRows).insertMany(rows.map((row) => ({ ...row, accountId, createdAt: now, updatedAt: now })));
    }
    await createNotification({
      accountId,
      userId: user.id,
      title: "Import ready for review",
      body: `${file.name} has ${rows.length} row${rows.length === 1 ? "" : "s"} ready to review.`,
      tone: rows.some((row) => row.status === "possible_duplicate") ? "warning" : "info",
      eventType: "import_review",
      entityType: "importBatch",
      entityId: batchId
    });
    return created({ batch });
  } catch (error) {
    return handleApiError(error);
  }
}
