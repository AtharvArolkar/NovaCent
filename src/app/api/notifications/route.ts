import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { handleApiError, ok } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const notifications = await db.collection(collections.notifications).find({ accountId }).sort({ createdAt: -1 }).limit(50).toArray();
    return ok({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    await db.collection(collections.notifications).updateMany({ accountId, read: false }, { $set: { read: true } });
    return ok({ read: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const result = await db.collection(collections.notifications).deleteMany({ accountId });
    return ok({ cleared: true, deletedCount: result.deletedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
