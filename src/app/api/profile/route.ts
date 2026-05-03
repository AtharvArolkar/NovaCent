import { getCurrentUser } from "@/lib/server/auth";
import { handleApiError, ok } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { profilePatchSchema } from "@/lib/server/schemas";

type StoredProfile = {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  provider?: string;
  passwordHash?: string;
  defaultAccountId?: string;
  createdAt?: string;
  updatedAt?: string;
};

async function readProfile(userId: string) {
  const db = await getDb();
  const user = await db.collection<StoredProfile>(collections.users).findOne({ id: userId });

  if (!user) {
    throw new Error("Unauthorized");
  }

  const account = user.defaultAccountId
    ? await db.collection(collections.accounts).findOne({ id: user.defaultAccountId, userId })
    : null;

  return {
    id: user.id,
    name: user.name ?? user.email?.split("@")[0] ?? "User",
    email: user.email,
    image: user.image,
    provider: user.provider ?? "credentials",
    defaultAccountId: user.defaultAccountId,
    defaultAccountName: account?.name ?? "Primary Account",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    canChangePassword: Boolean(user.passwordHash)
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ profile: await readProfile(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    const payload = profilePatchSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date().toISOString();

    await db.collection(collections.users).updateOne(
      { id: user.id },
      {
        $set: {
          name: payload.name.trim(),
          updatedAt: now
        }
      }
    );

    return ok({ profile: await readProfile(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
