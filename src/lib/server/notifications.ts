import { collections, getDb } from "@/lib/server/mongodb";

type NotificationTone = "info" | "warning" | "success";

interface NotificationInput {
  accountId: string;
  userId?: string;
  title: string;
  body: string;
  tone?: NotificationTone;
  eventType?: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(input: NotificationInput) {
  const db = await getDb();
  const now = new Date().toISOString();
  const notification = {
    id: crypto.randomUUID(),
    accountId: input.accountId,
    userId: input.userId,
    title: input.title,
    body: input.body,
    tone: input.tone ?? "info",
    read: false,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    createdAt: now
  };

  await db.collection(collections.notifications).insertOne(notification);
  return notification;
}
