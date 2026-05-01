import bcrypt from "bcryptjs";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, problem } from "@/lib/server/http";
import { registerSchema } from "@/lib/server/schemas";
import { appConfig } from "@/lib/app-config";

export async function POST(request: Request) {
  try {
    const payload = registerSchema.parse(await request.json());
    const db = await getDb();
    const existing = await db.collection(collections.users).findOne({ email: payload.email });

    if (existing) {
      return problem("An account already exists for this email.", 409);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(payload.password, 12);

    await db.collection(collections.users).insertOne({
      id: userId,
      name: payload.name,
      email: payload.email,
      passwordHash,
      provider: "credentials",
      defaultAccountId: accountId,
      createdAt: now,
      updatedAt: now
    });

    await db.collection(collections.accounts).insertOne({
      id: accountId,
      userId,
      name: "Primary INR Account",
      baseCurrency: appConfig.baseCurrency,
      isDefault: true,
      createdAt: now,
      updatedAt: now
    });

    return created({ userId, accountId });
  } catch (error) {
    return handleApiError(error);
  }
}

