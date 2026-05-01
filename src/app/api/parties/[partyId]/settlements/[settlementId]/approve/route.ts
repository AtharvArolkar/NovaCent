import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { settlementApprovalSchema } from "@/lib/server/schemas";

interface RouteContext {
  params: Promise<{ partyId: string; settlementId: string }> | { partyId: string; settlementId: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId, settlementId } = await context.params;
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = settlementApprovalSchema.parse(await request.json().catch(() => ({})));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const settlement = await db.collection(collections.settlements).findOne({ id: settlementId, accountId, partyId, status: "pending_approval" });
    if (!settlement) {
      return problem("Pending settlement was not found.", 404);
    }

    const now = new Date().toISOString();
    const nextStatus = payload.action === "reject" ? "rejected" : "settled";
    await db.collection(collections.settlements).updateOne(
      { id: settlementId, accountId, partyId, status: "pending_approval" },
      {
        $set: {
          status: nextStatus,
          approvedAt: payload.action === "approve" ? now : undefined,
          rejectedAt: payload.action === "reject" ? now : undefined,
          approvalReason: payload.reason
        }
      }
    );
    await db.collection(collections.splits).updateOne(
      { id: settlement.splitId, accountId, partyId },
      { $set: { status: payload.action === "approve" ? "settled" : "open", updatedAt: now } }
    );
    await createNotification({
      accountId,
      userId: user.id,
      title: payload.action === "approve" ? "Settlement approved" : "Settlement rejected",
      body: payload.action === "approve" ? "A registered participant settlement was approved." : "A registered participant settlement was rejected.",
      tone: payload.action === "approve" ? "success" : "warning",
      eventType: "settlement",
      entityType: "settlement",
      entityId: settlementId
    });

    return ok({ settlementId, status: nextStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
