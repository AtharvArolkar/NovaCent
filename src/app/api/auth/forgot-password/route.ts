import { addMinutes } from "date-fns";
import { collections, getDb } from "@/lib/server/mongodb";
import { handleApiError, ok } from "@/lib/server/http";
import { resetRequestSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const { email } = resetRequestSchema.parse(await request.json());
    const db = await getDb();
    const user = await db.collection(collections.users).findOne({ email });
    const genericResponse = { message: "If the email exists, a reset link has been prepared." };

    if (!user) {
      return ok(genericResponse);
    }

    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = addMinutes(new Date(), 30).toISOString();
    await db.collection(collections.passwordResetTokens).insertOne({
      token,
      userId: user.id,
      usedAt: null,
      expiresAt,
      createdAt: new Date().toISOString()
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;

    return ok({
      ...genericResponse,
      developmentResetUrl: process.env.SMTP_HOST ? undefined : resetUrl
    });
  } catch (error) {
    return handleApiError(error);
  }
}

