import bcrypt from "bcryptjs";
import { collections, getDb } from "@/lib/server/mongodb";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { resetPasswordSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const payload = resetPasswordSchema.parse(await request.json());
    const db = await getDb();
    const token = await db.collection(collections.passwordResetTokens).findOne({
      token: payload.token,
      usedAt: null,
      expiresAt: { $gt: new Date().toISOString() }
    });

    if (!token) {
      return problem("Reset token is invalid or expired.", 400);
    }

    await db.collection(collections.users).updateOne(
      { id: token.userId },
      {
        $set: {
          passwordHash: await bcrypt.hash(payload.password, 12),
          updatedAt: new Date().toISOString()
        }
      }
    );
    await db.collection(collections.passwordResetTokens).updateOne({ token: payload.token }, { $set: { usedAt: new Date().toISOString() } });

    return ok({ message: "Password updated." });
  } catch (error) {
    return handleApiError(error);
  }
}

