import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { changePasswordSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const payload = changePasswordSchema.parse(await request.json());
    const db = await getDb();
    const storedUser = await db.collection(collections.users).findOne({ id: user.id });

    if (!storedUser?.passwordHash) {
      return problem("Password change is only available for email/password accounts.", 400);
    }

    const valid = await bcrypt.compare(payload.currentPassword, storedUser.passwordHash);
    if (!valid) {
      return problem("Current password is incorrect.", 400);
    }

    await db.collection(collections.users).updateOne(
      { id: user.id },
      {
        $set: {
          passwordHash: await bcrypt.hash(payload.newPassword, 12),
          updatedAt: new Date().toISOString()
        }
      }
    );

    return ok({ message: "Password changed." });
  } catch (error) {
    return handleApiError(error);
  }
}

