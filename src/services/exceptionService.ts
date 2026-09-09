/**
 * Phase 25 Exception Management & Operational Workflow Engine
 * Deterministic detection, lifecycle management, and automatic task generation
 * for all operational anomalies without duplicating or recalculating financial balances.
 */

import {
  OperationalException,
  OperationalExceptionSeverity,
  OperationalExceptionStatus,
  OperationalExceptionType,
  OperationalTask,
  Owner,
  Property,
  Unit,
  Tenant,
  Lease,
  Cheque,
  RentalCase,
  MaintenanceRequest,
  OwnerTransferRecord,
  CommissionObligation,
  OperationalDocumentRecord,
  OperationalCommunicationRecord,
  PaymentPromise,
  CollectionAction,
} from "../types";

export interface ScanExceptionsInput {
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  cheques: Cheque[];
  cases: RentalCase[];
  maintenanceRequests: MaintenanceRequest[];
  ownerTransfers?: OwnerTransferRecord[];
  commissions?: CommissionObligation[];
  documents?: OperationalDocumentRecord[];
  tasks?: OperationalTask[];
  communications?: OperationalCommunicationRecord[];
  paymentPromises?: PaymentPromise[];
  collectionActions?: CollectionAction[];
}

export function scanOperationalExceptions(data: ScanExceptionsInput): OperationalException[] {
  const exceptions: OperationalException[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTime = now.getTime();
  let counter = 1;

  const makeId = (prefix: string) => `${prefix}-${String(counter++).padStart(4, "0")}`;

  const addException = (
    type: OperationalExceptionType,
    severity: OperationalExceptionSeverity,
    titleAr: string,
    titleEn: string,
    descriptionAr: string,
    descriptionEn: string,
    sourceEntity: OperationalException["sourceEntity"],
    sourceRecordId: string,
    extra: Partial<OperationalException> = {}
  ) => {
    const dedupeKey = `EXP:${sourceEntity}:${sourceRecordId}:${type}`;
    exceptions.push({
      id: makeId("EXC"),
      exceptionNumber: `EXC-${String(counter).padStart(4, "0")}`,
      dedupeKey,
      type,
      severity,
      titleAr,
      titleEn,
      descriptionAr,
      descriptionEn,
      sourceEntity,
      sourceRecordId,
      status: "OPEN",
      createdAt: todayStr,
      ...extra,
    });
  };

  // 1. LEASE LIFECYCLE EXCEPTIONS
  (data.leases || []).forEach((lease) => {
    if (lease.contractStatus === "EXPIRED" || (lease.endDate && new Date(lease.endDate).getTime() < currentTime && lease.contractStatus === "ACTIVE")) {
      addException(
        "LEASE_EXPIRED",
        "HIGH",
        `عقد إيجار منتهي (${lease.leaseNumber || lease.id})`,
        `Expired Lease Contract (${lease.leaseNumber || lease.id})`,
        `انتهى عقد الإيجار ولم يتم التجديد أو إنهاء العلاقة الإيجارية رسمياً`,
        `Lease contract has passed end date without renewal or formal termination`,
        "LEASE",
        lease.id,
        {
          ownerId: lease.ownerId,
          tenantId: lease.tenantId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          leaseId: lease.id,
          dueDate: lease.endDate,
          actionRoute: { view: "LEASES", subId: lease.id, entityType: "LEASE" },
        }
      );
    } else if (lease.contractStatus === "UNDER_RENEWAL") {
      addException(
        "LEASE_RENEWAL_PENDING",
        "WARNING",
        `تجديد قيد الإجراء لعقد ${lease.leaseNumber || lease.id}`,
        `Renewal Pending for Lease ${lease.leaseNumber || lease.id}`,
        `العقد في مرحلة التفاوض والتجديد ويتطلب استكمال الإجراءات والوثائق`,
        `Lease is currently under renewal process requiring finalization and documents`,
        "LEASE",
        lease.id,
        {
          ownerId: lease.ownerId,
          tenantId: lease.tenantId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          leaseId: lease.id,
          dueDate: lease.endDate,
          actionRoute: { view: "LEASES", subId: lease.id, entityType: "LEASE" },
        }
      );
    } else if (lease.contractStatus === "ACTIVE" && lease.endDate) {
      const endMs = new Date(lease.endDate).getTime();
      const daysLeft = Math.ceil((endMs - currentTime) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 30 && daysLeft > 0) {
        addException(
          "LEASE_EXPIRING_30",
          "HIGH",
          `عقد إيجار ينتهي خلال أقل من 30 يوماً (${daysLeft} يوم)`,
          `Lease Expiring in < 30 Days (${daysLeft} days left)`,
          `عقد الإيجار ${lease.leaseNumber || lease.id} ينتهي قريباً ويتطلب إخطار التجديد أو الإخلاء`,
          `Lease ${lease.leaseNumber || lease.id} expires in ${daysLeft} days. Action required immediately.`,
          "LEASE",
          lease.id,
          {
            ownerId: lease.ownerId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            leaseId: lease.id,
            dueDate: lease.endDate,
            actionRoute: { view: "LEASES", subId: lease.id, entityType: "LEASE" },
          }
        );
      } else if (daysLeft <= 60 && daysLeft > 30) {
        addException(
          "LEASE_EXPIRING_60",
          "WARNING",
          `عقد إيجار ينتهي خلال 60 يوماً (${daysLeft} يوم)`,
          `Lease Expiring in 60 Days (${daysLeft} days left)`,
          `عقد الإيجار ${lease.leaseNumber || lease.id} ينتهي خلال شهرين`,
          `Lease ${lease.leaseNumber || lease.id} expires in ${daysLeft} days`,
          "LEASE",
          lease.id,
          {
            ownerId: lease.ownerId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            leaseId: lease.id,
            dueDate: lease.endDate,
            actionRoute: { view: "LEASES", subId: lease.id, entityType: "LEASE" },
          }
        );
      } else if (daysLeft <= 90 && daysLeft > 60) {
        addException(
          "LEASE_EXPIRING_90",
          "INFORMATION",
          `عقد إيجار ينتهي خلال 90 يوماً (${daysLeft} يوم)`,
          `Lease Expiring in 90 Days (${daysLeft} days left)`,
          `عقد الإيجار ${lease.leaseNumber || lease.id} يدخل فترة الإخطار القانونية 90 يوماً`,
          `Lease ${lease.leaseNumber || lease.id} enters the 90-day statutory notice period`,
          "LEASE",
          lease.id,
          {
            ownerId: lease.ownerId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            leaseId: lease.id,
            dueDate: lease.endDate,
            actionRoute: { view: "LEASES", subId: lease.id, entityType: "LEASE" },
          }
        );
      }
    }
  });

  // 2. DOCUMENT EXPIRY & MISSING EXCEPTIONS
  (data.documents || []).forEach((doc) => {
    if (doc.status === "EXPIRED" || (doc.expiryDate && new Date(doc.expiryDate).getTime() < currentTime)) {
      addException(
        "DOCUMENT_EXPIRED",
        "HIGH",
        `وثيقة منتهية الصلاحية: ${doc.title}`,
        `Expired Document: ${doc.title}`,
        `انتهت صلاحية الوثيقة ${doc.documentNumber || doc.title} ويجب تجديدها وتحديثها على جوجل درايف`,
        `Document ${doc.documentNumber || doc.title} has expired. Renewal required.`,
        "DOCUMENT",
        doc.id,
        {
          ownerId: doc.ownerId,
          tenantId: doc.tenantId,
          propertyId: doc.propertyId,
          unitId: doc.unitId,
          leaseId: doc.leaseId,
          dueDate: doc.expiryDate,
          actionRoute: { view: "DOCUMENT_CONTROL", subId: doc.id, entityType: "DOCUMENT" },
        }
      );
    } else if (doc.expiryDate) {
      const expMs = new Date(doc.expiryDate).getTime();
      const daysLeft = Math.ceil((expMs - currentTime) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30 && daysLeft > 0) {
        addException(
          "DOCUMENT_EXPIRING_30",
          "HIGH",
          `وثيقة تنتهي خلال أقل من 30 يوماً (${doc.title})`,
          `Document Expiring in < 30 Days (${doc.title})`,
          `تنتهي صلاحية الوثيقة في ${doc.expiryDate} (${daysLeft} يوم متبقي)`,
          `Document expires on ${doc.expiryDate} (${daysLeft} days remaining)`,
          "DOCUMENT",
          doc.id,
          {
            ownerId: doc.ownerId,
            tenantId: doc.tenantId,
            propertyId: doc.propertyId,
            unitId: doc.unitId,
            leaseId: doc.leaseId,
            dueDate: doc.expiryDate,
            actionRoute: { view: "DOCUMENT_CONTROL", subId: doc.id, entityType: "DOCUMENT" },
          }
        );
      } else if (daysLeft <= 60 && daysLeft > 30) {
        addException(
          "DOCUMENT_EXPIRING_60",
          "WARNING",
          `وثيقة تنتهي خلال 60 يوماً (${doc.title})`,
          `Document Expiring in 60 Days (${doc.title})`,
          `تنتهي صلاحية الوثيقة في ${doc.expiryDate}`,
          `Document expires on ${doc.expiryDate}`,
          "DOCUMENT",
          doc.id,
          {
            ownerId: doc.ownerId,
            tenantId: doc.tenantId,
            propertyId: doc.propertyId,
            unitId: doc.unitId,
            leaseId: doc.leaseId,
            dueDate: doc.expiryDate,
            actionRoute: { view: "DOCUMENT_CONTROL", subId: doc.id, entityType: "DOCUMENT" },
          }
        );
      }
    }
  });

  // 3. OVERDUE OPERATIONAL TASKS
  (data.tasks || []).forEach((task) => {
    if (task.status !== "COMPLETED" && task.status !== "CANCELLED" && task.dueDate) {
      const dueMs = new Date(task.dueDate).getTime();
      if (dueMs < currentTime && task.dueDate !== todayStr) {
        addException(
          "OVERDUE_TASK",
          task.priority === "URGENT" || task.priority === "HIGH" ? "CRITICAL" : "HIGH",
          `مهمة تشغيلية متأخرة: ${task.title}`,
          `Overdue Operational Task: ${task.title}`,
          `المهمة #${task.taskNumber || task.id} تجاوزت تاريخ الاستحقاق (${task.dueDate})`,
          `Task #${task.taskNumber || task.id} is overdue past ${task.dueDate}`,
          "TASK",
          task.id,
          {
            assignedUserName: task.assignedUserName,
            dueDate: task.dueDate,
            ownerId: task.ownerId,
            tenantId: task.tenantId,
            propertyId: task.propertyId,
            unitId: task.unitId,
            leaseId: task.leaseId,
            actionRoute: { view: "TASK_CENTER", subId: task.id, entityType: "TASK" },
          }
        );
      }
    }
  });

  // 4. BOUNCED CHEQUES WITHOUT LEGAL ACTION
  (data.cheques || []).forEach((cheque) => {
    if (cheque.status === "BOUNCED" || cheque.originalStatus === "BOUNCED") {
      const hasCase = (data.cases || []).some((c) => (c.linkedChequeIds || []).includes(cheque.id));
      if (!hasCase) {
        addException(
          "BOUNCED_CHEQUE",
          "CRITICAL",
          `شيك مرتجع بدون دعوى قضائية (#${cheque.chequeNumber})`,
          `Bounced Cheque without Legal Case (#${cheque.chequeNumber})`,
          `شيك مرتجع بقيمة ${cheque.outstanding || cheque.amount} درهم لم يتم تسويته أو فتح ملف نزاع إيجاري له`,
          `Bounced cheque of ${cheque.outstanding || cheque.amount} AED without legal action or settlement`,
          "CHEQUE",
          cheque.id,
          {
            chequeId: cheque.id,
            ownerId: cheque.ownerId,
            tenantId: cheque.tenantId,
            propertyId: cheque.propertyId,
            unitId: cheque.unitId,
            leaseId: cheque.leaseId,
            amount: cheque.outstanding || cheque.amount,
            dueDate: cheque.dueDate || cheque.chequeDate,
            actionRoute: { view: "BOUNCED_CHEQUES", subId: cheque.id, entityType: "CHEQUE" },
          }
        );
      }
    }
  });

  // 5. BROKEN PAYMENT PROMISES
  (data.paymentPromises || []).forEach((promise) => {
    if (promise.status === "BROKEN" || (promise.status === "ACTIVE" && new Date(promise.expectedPaymentDate).getTime() < currentTime)) {
      addException(
        "BROKEN_PAYMENT_PROMISE",
        "CRITICAL",
        `إخلال بوعد سداد (${promise.promiseNumber || promise.id})`,
        `Broken Payment Promise (${promise.promiseNumber || promise.id})`,
        `المستأجر أخل بوعد سداد مبلغ ${promise.amountPromised} درهم المستحق بتاريخ ${promise.expectedPaymentDate}`,
        `Tenant defaulted on promise to pay ${promise.amountPromised} AED due on ${promise.expectedPaymentDate}`,
        "PROMISE",
        promise.id,
        {
          tenantId: promise.tenantId,
          amount: promise.amountPromised,
          dueDate: promise.expectedPaymentDate,
          actionRoute: { view: "COLLECTIONS_CENTER", subId: promise.id, entityType: "COLLECTION" },
        }
      );
    }
  });

  // 6. UNPOSTED APPROVED MAINTENANCE EXPENSES
  (data.maintenanceRequests || []).forEach((req) => {
    if (req.status === "COMPLETED" && req.totalCost && req.totalCost > 0 && req.financialStatus !== "POSTED") {
      addException(
        "UNPOSTED_MAINTENANCE_EXPENSE",
        "HIGH",
        `طلب صيانة معتمد غير مرحل مالياً (#${req.requestNumber || req.id})`,
        `Unposted Approved Maintenance (#${req.requestNumber || req.id})`,
        `تم اعتماد صيانة بقيمة ${req.totalCost} درهم ولم يتم ترحيلها إلى مصروفات العقار أو خصمها من المالك/المستأجر`,
        `Maintenance of ${req.totalCost} AED approved but not posted to property expenses or ledger`,
        "MAINTENANCE",
        req.id,
        {
          propertyId: req.propertyId,
          unitId: req.unitId,
          tenantId: req.tenantId,
          amount: req.totalCost,
          actionRoute: { view: "MAINTENANCE", subId: req.id, entityType: "MAINTENANCE" },
        }
      );
    }
  });

  // 7. PENDING OWNER TRANSFERS
  (data.ownerTransfers || []).forEach((tr) => {
    if (tr.status === "PENDING_APPROVAL" || tr.status === "DRAFT") {
      addException(
        "PENDING_OWNER_TRANSFER",
        "HIGH",
        `دفعة تحويل للمالك بانتظار الاعتماد (#${tr.transferNumber || tr.id})`,
        `Pending Owner Transfer Approval (#${tr.transferNumber || tr.id})`,
        `حوالة معلقة للمالك بقيمة ${tr.amount} درهم تتطلب المراجعة والاعتماد`,
        `Pending owner transfer of ${tr.amount} AED requiring approval`,
        "TRANSFER",
        tr.id,
        {
          ownerId: tr.ownerId,
          amount: tr.amount,
          dueDate: tr.transferDate,
          actionRoute: { view: "FINANCIALS", subId: tr.id, entityType: "TRANSFER" },
        }
      );
    }
  });

  // 8. PENDING ADMINISTRATIVE FEES / COMMISSIONS
  (data.commissions || []).forEach((com) => {
    if (com.status === "DUE" && com.outstandingBalance > 0) {
      addException(
        "PENDING_ADMIN_FEE",
        "WARNING",
        `رسوم إدارية وعمولة غير محصلة (${com.businessKey || com.id})`,
        `Uncollected Administrative Fee / Commission (${com.businessKey || com.id})`,
        `عمولة إدارة عقود مستحقة بقيمة ${com.outstandingBalance} درهم لم يتم تحصيلها`,
        `Administrative fee of ${com.outstandingBalance} AED due and uncollected`,
        "FEE",
        com.id,
        {
          ownerId: com.ownerId,
          propertyId: com.propertyId,
          leaseId: com.leaseId,
          amount: com.outstandingBalance,
          dueDate: com.dueDate,
          actionRoute: { view: "FINANCIALS", subId: com.id, entityType: "FEE" },
        }
      );
    }
  });

  // 9. FAILED COMMUNICATIONS
  (data.communications || []).forEach((comm) => {
    if (comm.status === "FAILED") {
      addException(
        "FAILED_COMMUNICATION",
        "HIGH",
        `فشل إرسال إشعار ${comm.channel}: ${comm.subject}`,
        `Failed ${comm.channel} Notice: ${comm.subject}`,
        `فشل تسليم الإشعار للمستلم ${comm.recipient}. يرجى التحقق وإعادة الإرسال`,
        `Failed to deliver ${comm.channel} notice to ${comm.recipient}. Verification required.`,
        "COMMUNICATION",
        comm.id,
        {
          tenantId: comm.tenantId,
          ownerId: comm.ownerId,
          propertyId: comm.propertyId,
          leaseId: comm.leaseId,
          actionRoute: { view: "NOTIFICATIONS", subId: comm.id, entityType: "COMMUNICATION" },
        }
      );
    }
  });

  return exceptions;
}

/**
 * Deterministic Task Generator from Exceptions
 * Uses key format: TASK:{sourceType}:{sourceId}:{taskType}:{dueDate}
 * Prevents active duplicate tasks from ever being created.
 */
export function generateTasksFromExceptions(
  exceptions: OperationalException[],
  existingTasks: OperationalTask[] = []
): { newTasks: OperationalTask[]; duplicateCount: number } {
  const newTasks: OperationalTask[] = [];
  const existingKeys = new Set(
    existingTasks
      .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
      .map((t) => `TASK:${t.propertyId || ""}:${t.leaseId || t.maintenanceRequestId || t.legalCaseId || t.id}:${t.title}:${t.dueDate || ""}`)
  );

  let duplicateCount = 0;
  const todayStr = new Date().toISOString().split("T")[0];

  exceptions.forEach((exc) => {
    // Only auto-generate tasks for HIGH and CRITICAL severity exceptions
    if (exc.severity !== "HIGH" && exc.severity !== "CRITICAL") return;
    if (exc.status === "RESOLVED" || exc.status === "DISMISSED") return;

    const taskKey = `TASK:${exc.sourceEntity}:${exc.sourceRecordId}:${exc.type}:${exc.dueDate || todayStr}`;

    if (existingKeys.has(taskKey)) {
      duplicateCount++;
      return;
    }

    existingKeys.add(taskKey);

    const taskNumber = `TSK-${String(existingTasks.length + newTasks.length + 1).padStart(4, "0")}`;
    const newTask: OperationalTask = {
      id: `task-auto-${exc.id}`,
      taskNumber,
      title: exc.titleEn,
      description: `${exc.descriptionEn} [Ref: ${exc.exceptionNumber}]`,
      propertyId: exc.propertyId,
      unitId: exc.unitId,
      tenantId: exc.tenantId,
      ownerId: exc.ownerId,
      leaseId: exc.leaseId,
      legalCaseId: exc.caseId,
      priority: exc.severity === "CRITICAL" ? "URGENT" : "HIGH",
      status: "OPEN",
      dueDate: exc.dueDate || todayStr,
      createdAt: todayStr,
      createdById: "SYSTEM_AUTOPILOT",
      createdByName: "Operational Control Engine",
      assignedUserName: exc.assignedUserName || "Property Operations Team",
    };

    newTasks.push(newTask);
  });

  return { newTasks, duplicateCount };
}

/**
 * Resolves an exception with mandatory resolution notes and user audit metadata
 */
export function resolveOperationalException(
  exception: OperationalException,
  resolutionNotes: string,
  user: { id: string; name: string }
): { success: boolean; updatedException?: OperationalException; error?: string } {
  if (!resolutionNotes || resolutionNotes.trim().length === 0) {
    return { success: false, error: "Resolution notes are mandatory." };
  }

  const updated: OperationalException = {
    ...exception,
    status: "RESOLVED",
    resolutionNotes: resolutionNotes.trim(),
    resolvedByUserId: user.id,
    resolvedByUserName: user.name,
    resolvedAt: new Date().toISOString(),
  };

  return { success: true, updatedException: updated };
}

/**
 * Dismisses an exception with mandatory justification reason
 */
export function dismissOperationalException(
  exception: OperationalException,
  dismissalReason: string,
  user: { id: string; name: string }
): { success: boolean; updatedException?: OperationalException; error?: string } {
  if (!dismissalReason || dismissalReason.trim().length === 0) {
    return { success: false, error: "A non-empty dismissal reason is required." };
  }

  const updated: OperationalException = {
    ...exception,
    status: "DISMISSED",
    dismissalReason: dismissalReason.trim(),
    resolvedByUserId: user.id,
    resolvedByUserName: user.name,
    resolvedAt: new Date().toISOString(),
  };

  return { success: true, updatedException: updated };
}
