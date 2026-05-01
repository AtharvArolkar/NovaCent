import { addMinutes } from "date-fns";
import { collections, getDb } from "@/lib/server/mongodb";
import { sendEmail, smtpConfigured } from "@/lib/server/email";
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
    if (smtpConfigured()) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your NovaCent password",
          text: [
            "We received a request to reset your NovaCent password.",
            "",
            `Open this link within 30 minutes: ${resetUrl}`,
            "",
            "If you did not request this, you can ignore this email."
          ].join("\n")
        });
      } catch {
        return ok(genericResponse);
      }
    }

    return ok({
      ...genericResponse,
      developmentResetUrl: smtpConfigured() ? undefined : resetUrl
    });
  } catch (error) {
    return handleApiError(error);
  }
}
