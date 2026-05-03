import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { parseStatementFile, StatementPasswordError } from "@/lib/server/import-parser";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { markPossibleImportDuplicates } from "@/lib/server/import-duplicates";
import { createNotification } from "@/lib/server/notifications";
import type { CategoryRule, ImportRow } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const url = new URL(request.url);
    const duplicateOnly = url.searchParams.get("duplicates") === "true";
    const status = url.searchParams.get("status");
    const requestedLimit = Number(url.searchParams.get("limit") ?? 2000);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 5000)) : 2000;
    const batches = await db.collection(collections.importBatches)
      .find({ accountId })
      .project({ rows: 0 })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    const batchIds = batches.map((batch) => String(batch.id));
    const rowQuery: Record<string, unknown> = {
      accountId,
      batchId: { $in: batchIds }
    };

    if (status) {
      rowQuery.status = status;
    } else {
      rowQuery.status = { $in: ["review", "possible_duplicate"] };
    }

    if (duplicateOnly) {
      rowQuery["possibleDuplicates.0"] = { $exists: true };
    }

    const rows = batchIds.length
      ? await db.collection<ImportRow & { accountId: string }>(collections.importRows)
          .find(rowQuery)
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
      : [];
    const rowsByBatch = new Map<string, typeof rows>();
    for (const row of rows) {
      const batchRows = rowsByBatch.get(row.batchId) ?? [];
      batchRows.push(row);
      rowsByBatch.set(row.batchId, batchRows);
    }

    return ok({
      batches: batches.map((batch) => ({
        ...batch,
        rows: rowsByBatch.get(String(batch.id)) ?? []
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const formData = await request.formData();
    const file = formData.get("file");
    const statementPassword = String(formData.get("statementPassword") ?? "").trim() || undefined;

    if (!(file instanceof File)) {
      return problem("A statement file is required.", 400);
    }

    const db = await getDb();
    const batchId = crypto.randomUUID();
    const rules = await db.collection<CategoryRule>(collections.categoryRules).find({ accountId }).toArray();
    let parsedRows: Awaited<ReturnType<typeof parseStatementFile>>;
    try {
      parsedRows = await parseStatementFile(file, batchId, rules, { statementPassword });
    } catch (error) {
      if (error instanceof StatementPasswordError) {
        const now = new Date().toISOString();
        const failedBatch = {
          id: batchId,
          accountId,
          fileName: file.name,
          status: "failed",
          rows: [],
          failureReason: error.reason,
          failureMessage: error.message,
          createdAt: now,
          updatedAt: now,
          originalFileDeleted: true
        };
        await db.collection(collections.importBatches).insertOne(failedBatch);
        await createNotification({
          accountId,
          userId: user.id,
          title: "Statement import needs password",
          body: error.message,
          tone: "warning",
          eventType: "import_review",
          entityType: "importBatch",
          entityId: batchId
        });
        return problem(error.message, error.reason === "required" ? 422 : 401, { batch: failedBatch, reason: error.reason });
      }
      throw error;
    }
    const rows = await markPossibleImportDuplicates(accountId, parsedRows);
    const now = new Date().toISOString();
    const duplicateCount = rows.filter((row) => row.status === "possible_duplicate").length;
    const batch = {
      id: batchId,
      accountId,
      fileName: file.name,
      status: "review",
      rows: [],
      rowCount: rows.length,
      pendingCount: rows.length,
      duplicateCount,
      approvedCount: 0,
      deletedCount: 0,
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
    return created({ batch: { ...batch, rows } });
  } catch (error) {
    return handleApiError(error);
  }
}
