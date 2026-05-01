import { accountIdFromRequest, getCurrentUser, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { accountSchema } from "@/lib/server/schemas";
import { appConfig } from "@/lib/app-config";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = await getDb();
    const accounts = await db.collection(collections.accounts).find({ userId: user.id }).sort({ isDefault: -1, createdAt: 1 }).toArray();
    return ok({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const payload = accountSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date().toISOString();
    const account = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: payload.name,
      baseCurrency: payload.baseCurrency || appConfig.baseCurrency,
      isDefault: false,
      createdAt: now,
      updatedAt: now
    };
    await db.collection(collections.accounts).insertOne(account);
    return created({ account });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const user = await getCurrentUser();
    const db = await getDb();
    await db.collection(collections.accounts).updateMany({ userId: user.id }, { $set: { isDefault: false } });
    await db.collection(collections.accounts).updateOne({ id: accountId, userId: user.id }, { $set: { isDefault: true, updatedAt: new Date().toISOString() } });
    await db.collection(collections.users).updateOne({ id: user.id }, { $set: { defaultAccountId: accountId } });
    return ok({ accountId });
  } catch (error) {
    return handleApiError(error);
  }
}

