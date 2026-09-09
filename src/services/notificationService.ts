/**
 * Phase 12 Notification Service & Event Dispatcher
 * Provides centralized management for WhatsApp, Email, and In-App notifications,
 * idempotency duplicate checks, retry policies, and financial read-only protection.
 */

import { DEFAULT_NOTIFICATION_TEMPLATES, NotificationTemplate } from "./notificationTemplates";

export interface NotificationRecordItem {
  id: string;
  notificationNumber: string;
  eventType: string;
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  recipientType: "TENANT" | "OWNER" | "STAFF" | "MANAGEMENT";
  recipientId: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  subject: string;
  messageBody: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "RETRY_PENDING";
  attemptCount: number;
  createdAt: string;
  idempotencyKey: string;
}

const IN_MEMORY_NOTIFICATIONS: NotificationRecordItem[] = [];

export function generateIdempotencyKey(eventType: string, entityId: string, recipientId: string, channel: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `${eventType}_${entityId}_${recipientId}_${channel}_${today}`;
}

export async function sendNotification(params: {
  eventType: string;
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  recipientType: "TENANT" | "OWNER" | "STAFF" | "MANAGEMENT";
  recipientId: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  variables: Record<string, string | number>;
  entityId: string;
  language?: "ar" | "en";
}): Promise<NotificationRecordItem> {
  const lang = params.language || "ar";
  const idempotencyKey = generateIdempotencyKey(params.eventType, params.entityId, params.recipientId, params.channel);

  const existing = IN_MEMORY_NOTIFICATIONS.find((n) => n.idempotencyKey === idempotencyKey);
  if (existing) {
    return existing;
  }

  const template = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.eventType === params.eventType && t.channel === params.channel) || {
    subjectAr: "إشعار من صقر الامارات",
    subjectEn: "Notification from Emirates Falcon",
    bodyAr: `إشعار بخصوص الحدث ${params.eventType}`,
    bodyEn: `Notification regarding event ${params.eventType}`,
  };

  let subject = lang === "ar" ? template.subjectAr : template.subjectEn;
  let body = lang === "ar" ? template.bodyAr : template.bodyEn;

  Object.entries(params.variables).forEach(([key, val]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    const valStr = String(val ?? "");
    subject = subject.replace(regex, valStr);
    body = body.replace(regex, valStr);
  });

  const record: NotificationRecordItem = {
    id: `notif_${Date.now()}_${crypto.randomUUID().split("-")[0]}`,
    notificationNumber: `REF-${Date.now() % 10000}`,
    eventType: params.eventType,
    channel: params.channel,
    recipientType: params.recipientType,
    recipientId: params.recipientId,
    recipientName: params.recipientName,
    recipientPhone: params.recipientPhone,
    recipientEmail: params.recipientEmail,
    subject,
    messageBody: body,
    status: "PENDING", // PENDING by default
    attemptCount: 1,
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };
  
  if (params.channel === "EMAIL" && params.recipientEmail) {
    try {
      const res = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "EMAIL",
          recipient: params.recipientEmail,
          template: params.eventType,
          tenantName: params.recipientName,
          customMessage: body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        record.status = "SENT"; // Not DELIVERED unless we have webhooks, but SENT is accurate
      } else {
        record.status = "FAILED";
      }
    } catch (e) {
      record.status = "FAILED";
    }
  } else if (params.channel === "IN_APP") {
    record.status = "DELIVERED";
  } else {
    // WHATSAPP etc which are not implemented backend
    record.status = "FAILED"; 
  }

  IN_MEMORY_NOTIFICATIONS.unshift(record);
  return record;
}

export function getNotificationsList(): NotificationRecordItem[] {
  return IN_MEMORY_NOTIFICATIONS;
}
