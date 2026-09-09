import { Cheque, Tenant, AuditLogEntry } from "../types";

export interface ChequeBackgroundJobResult {
  checkedCount: number;
  remindersSentCount: number;
  failedCount: number;
  details: Array<{
    chequeId: string;
    chequeNumber: string;
    tenantName: string;
    dueDate: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error?: string;
  }>;
}

export async function runChequeDueDateBackgroundJob(
  cheques: Cheque[],
  tenants: Tenant[],
  logAudit: (
    action: AuditLogEntry["action"],
    entityType: AuditLogEntry["entityType"],
    entityId: string,
    entityName: string,
    details: string,
    oldValue?: string,
    newValue?: string,
    reason?: string
  ) => void,
  updateChequeReminderMeta?: (chequeId: string, lastReminderDate: string) => void
): Promise<ChequeBackgroundJobResult> {
  const result: ChequeBackgroundJobResult = {
    checkedCount: 0,
    remindersSentCount: 0,
    failedCount: 0,
    details: []
  };

  // Calculate target date: 3 days from today (YYYY-MM-DD)
  const today = new Date();
  const targetDateObj = new Date(today);
  targetDateObj.setDate(today.getDate() + 3);
  const targetDateStr = targetDateObj.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  console.log(`[Cheque Background Job] Running check for due date: ${targetDateStr} (Today: ${todayStr})`);

  for (const cheque of cheques) {
    // Only check pending/active cheques whose due date matches target date (3 days away)
    if (!cheque.dueDate || cheque.dueDate !== targetDateStr) {
      continue;
    }

    if (cheque.status !== "PENDING" && cheque.status !== "POST_DATED") {
      // Skip already collected or bounced cheques
      continue;
    }

    // Skip if reminder already sent today or for this specific due date recently
    if (cheque.lastReminderDate && cheque.lastReminderDate.startsWith(todayStr)) {
      result.checkedCount++;
      result.details.push({
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        tenantName: "Skipped (Already notified today)",
        dueDate: cheque.dueDate,
        status: "SKIPPED"
      });
      continue;
    }

    result.checkedCount++;

    const tenant = tenants.find((t) => t.id === cheque.tenantId);
    if (!tenant || !tenant.email) {
      result.failedCount++;
      result.details.push({
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        tenantName: tenant ? (tenant.nameEn || tenant.nameAr) : "Unknown Tenant",
        dueDate: cheque.dueDate,
        status: "FAILED",
        error: "Tenant email address not found."
      });
      continue;
    }

    const tenantName = tenant.nameEn || tenant.nameAr;

    try {
      // Call backend API endpoint to dispatch email reminder
      const response = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          recipient: tenant.email,
          template: "APPROACHING_DUE",
          tenantName,
          chequeNumber: cheque.chequeNumber,
          amountAED: cheque.amount,
          dueDate: cheque.dueDate,
        })
      });

      const resData = await response.json();

      if (resData.success) {
        result.remindersSentCount++;
        result.details.push({
          chequeId: cheque.id,
          chequeNumber: cheque.chequeNumber,
          tenantName,
          dueDate: cheque.dueDate,
          status: "SENT"
        });

        // Record in AuditLogs
        logAudit(
          "NOTIFY",
          "CHEQUE",
          cheque.id,
          `شيك رقم #${cheque.chequeNumber}`,
          `[وظيفة الخلفية الآلية] تم إرسال تنبيه البريد الإلكتروني للمستأجر (${tenantName} - ${tenant.email}) لاقتراب موعد استحقاق الشيك بمبلغ ${cheque.amount} درهم في تاريخ ${cheque.dueDate} (قبل 3 أيام). حالة الإرسال: ناجح.`,
          undefined,
          `Delivered to ${tenant.email}`
        );

        if (updateChequeReminderMeta) {
          updateChequeReminderMeta(cheque.id, new Date().toISOString());
        }
      } else {
        result.failedCount++;
        result.details.push({
          chequeId: cheque.id,
          chequeNumber: cheque.chequeNumber,
          tenantName,
          dueDate: cheque.dueDate,
          status: "FAILED",
          error: resData.error || "Email delivery failed"
        });

        logAudit(
          "NOTIFY",
          "CHEQUE",
          cheque.id,
          `شيك رقم #${cheque.chequeNumber}`,
          `[وظيفة الخلفية الآلية] فشل إرسال تنبيه البريد الإلكتروني للمستأجر (${tenantName}) لاقتراب موعد استحقاق الشيك رقم #${cheque.chequeNumber}. السبب: ${resData.error || "خطأ غير معروف"}`,
          undefined,
          "Failed"
        );
      }
    } catch (err: any) {
      result.failedCount++;
      result.details.push({
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        tenantName,
        dueDate: cheque.dueDate,
        status: "FAILED",
        error: err.message
      });

      logAudit(
        "NOTIFY",
        "CHEQUE",
        cheque.id,
        `شيك رقم #${cheque.chequeNumber}`,
        `[وظيفة الخلفية الآلية] خطأ في الاتصال أثناء إرسال تنبيه الشيك رقم #${cheque.chequeNumber} للمستأجر ${tenantName}: ${err.message}`,
        undefined,
        "Error"
      );
    }
  }

  return result;
}
