import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { categoryRuleSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const rules = await db.collection(collections.categoryRules).find({ accountId }).sort({ pattern: 1 }).toArray();
    return ok({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = categoryRuleSchema.parse(await request.json());
    const db = await getDb();
    const rule = { id: crypto.randomUUID(), accountId, ...payload, createdAt: new Date().toISOString() };
    await db.collection(collections.categoryRules).insertOne(rule);
    return created({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

