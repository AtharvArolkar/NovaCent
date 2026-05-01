import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { sendEmail, smtpConfigured } from "@/lib/server/email";
import { handleApiError, created } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { supportRequestSchema } from "@/lib/server/schemas";
import type { SupportRequest } from "@/lib/domain";

const supportTypeLabel: Record<SupportRequest["type"], string> = {
  add_feature: "Add feature",
  report_issue: "Report issue",
  praise: "Praise"
};

export async function POST(request: Request) {
  try {
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = supportRequestSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date().toISOString();
    const supportRequest: SupportRequest & { emailStatus?: "not_configured" | "sent" | "failed" } = {
      id: crypto.randomUUID(),
      accountId,
      userId: user.id,
      name: payload.name,
      email: user.email ?? undefined,
      type: payload.type,
      comments: payload.comments,
      status: "open",
      createdAt: now,
      updatedAt: now,
      emailStatus: "not_configured"
    };

    await db.collection(collections.supportRequests).insertOne(supportRequest);

    if (smtpConfigured() && process.env.SUPPORT_ADMIN_EMAIL) {
      try {
        await sendEmail({
          to: process.env.SUPPORT_ADMIN_EMAIL,
          subject: `NovaCent support: ${supportTypeLabel[payload.type]}`,
          text: [
            `Request: ${supportTypeLabel[payload.type]}`,
            `Name: ${payload.name}`,
            `User: ${user.email ?? user.id}`,
            `Account: ${accountId}`,
            "",
            payload.comments
          ].join("\n")
        });
        supportRequest.emailStatus = "sent";
      } catch {
        supportRequest.emailStatus = "failed";
      }
      await db.collection(collections.supportRequests).updateOne(
        { id: supportRequest.id, accountId },
        { $set: { emailStatus: supportRequest.emailStatus, updatedAt: new Date().toISOString() } }
      );
    }

    return created({ supportRequest });
  } catch (error) {
    return handleApiError(error);
  }
}
