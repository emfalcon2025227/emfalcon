const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetStr = `
    try {
      let archiveDocId: string | undefined = undefined;
      if (proofBase64) {
        archiveDocId = \`arch-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`;
        const newArchiveRecord: ElectronicArchiveItem = {
          id: archiveDocId,
          fileName: proofFileName || \`proof-clearance-sd-\${lease.leaseNumber}.pdf\`,
          category: "PAYMENTS",
          recordId: lease.id,
          recordTitle: \`إثبات تسوية ورد تأمين عقد \${lease.leaseNumber}\`,
          fileType: "application/pdf",
          fileSize: 1024,
          fileHash: \`hash-\${Date.now()}\`,
          isPrivate: false,
          storagePath: \`archives/leases/\${lease.id}/\${proofFileName || "clearance-proof.pdf"}\`,
          uploadDate: nowIso,
          uploadedByUserId: userId,
          uploadedByName: userName,
          previewUrl: proofBase64,
          downloadToken: \`tok-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`,
          tags: ["security_deposit_settlement", "clearance", lease.id],
          entityType: "LEASE",
          entityId: lease.id,
          createdAt: nowIso,
        } as ElectronicArchiveItem;

        setArchive((prev) => [newArchiveRecord, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      const settlementRecord: SecurityDepositSettlement = {
        settlementId: \`sd-set-\${Date.now()}\`,
        settledAt: nowIso,
        settlementDate: todayDate,
        totalHeldAmount: totalHeld,
        maintenanceDeductions: cappedDeductions.maintenanceDeduction,
        maintenanceDeduction: cappedDeductions.maintenanceDeduction,
        rentDeductions: cappedDeductions.rentDeduction,
        rentDeduction: cappedDeductions.rentDeduction,
        earlyTerminationDeductions: cappedDeductions.earlyTerminationDeduction,
        earlyTerminationDeduction: cappedDeductions.earlyTerminationDeduction,
        otherDeductions: cappedDeductions.otherDeductions,
        totalDeductions: totalAppliedDeductions,
        netRefundAmount,
        remainingDueAmount,
        refundPaymentMethod,
        refundReference,
        settledByUserId: userId,
        settledByUserName: userName,
        notes: notes || (language === "ar" ? "تسوية وبراءة ذمة تأمين مستأجر نهائية" : "Final security deposit settlement & clearance"),
        proofDocumentId: archiveDocId,
      };

      const finalStatus: SecurityDepositStatus = netRefundAmount > 0 ? "REFUNDED" : "SETTLED";

      const historyItem: SecurityDepositHistoryItem = {
        id: \`sd-hist-\${Date.now()}\`,
        date: nowIso,
        action: netRefundAmount > 0 ? "REFUND" : "SETTLEMENT",
        amount: netRefundAmount > 0 ? netRefundAmount : totalHeld,
        performedBy: userName,
        notes: \`تسوية أمانات التأمين: إجمالي المحتجز AED \${totalHeld} - الخصومات AED \${totalDeductions} = صافي المردود AED \${netRefundAmount}\`,
      };

      const updatedLease: Lease = {
        ...lease,
        securityDepositStatus: finalStatus,
        securityDepositSettlement: settlementRecord,
        securityDepositHistory: [...(lease.securityDepositHistory || []), historyItem],
      };

      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));
      safeSetDoc(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });

      // Post Double-Entry Journal Entry
      let postedJournal: JournalEntryRecord | undefined = undefined;
      const journalData = buildSecurityDepositSettlementJournal(
        chartOfAccounts,
        {
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          tenantId: lease.tenantId,
          ownerId: lease.ownerId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          totalHeldAmount: totalHeld,
          deductions: cappedDeductions,
          netRefundAmount,
          refundPaymentMethod,
          reference: refundReference,
          transactionDate: todayDate,
          createdBy: userName,
          notes: notes || \`تسوية وبراءة ذمة تأمين مستأجر لعقد #\${lease.leaseNumber}\`,
        }
      );
      const jRes = postJournalEntry(journalData);
      if (!jRes.success || !jRes.entry) {
        return {
          success: false,
          error: language === "ar"
            ? \`فشل ترحيل القيد المحاسبي لتسوية أمانات التأمين: \${jRes.error || "خطأ محاسبي"}\`
            : \`Failed to post security deposit settlement journal entry: \${jRes.error || "Accounting error"}\`,
        };
      }
      postedJournal = jRes.entry;

      logAudit(
`;

const replaceStr = `
    try {
      let archiveDocId: string | undefined = undefined;
      let newArchiveRecord: ElectronicArchiveItem | null = null;
      if (proofBase64) {
        archiveDocId = \`arch-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`;
        newArchiveRecord = {
          id: archiveDocId,
          fileName: proofFileName || \`proof-clearance-sd-\${lease.leaseNumber}.pdf\`,
          category: "PAYMENTS",
          recordId: lease.id,
          recordTitle: \`إثبات تسوية ورد تأمين عقد \${lease.leaseNumber}\`,
          fileType: "application/pdf",
          fileSize: 1024,
          fileHash: \`hash-\${Date.now()}\`,
          isPrivate: false,
          storagePath: \`archives/leases/\${lease.id}/\${proofFileName || "clearance-proof.pdf"}\`,
          uploadDate: nowIso,
          uploadedByUserId: userId,
          uploadedByName: userName,
          previewUrl: proofBase64,
          downloadToken: \`tok-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`,
          tags: ["security_deposit_settlement", "clearance", lease.id],
          entityType: "LEASE",
          entityId: lease.id,
          createdAt: nowIso,
        } as ElectronicArchiveItem;
      }

      const settlementRecord: SecurityDepositSettlement = {
        settlementId: \`sd-set-\${Date.now()}\`,
        settledAt: nowIso,
        settlementDate: todayDate,
        totalHeldAmount: totalHeld,
        maintenanceDeductions: cappedDeductions.maintenanceDeduction,
        maintenanceDeduction: cappedDeductions.maintenanceDeduction,
        rentDeductions: cappedDeductions.rentDeduction,
        rentDeduction: cappedDeductions.rentDeduction,
        earlyTerminationDeductions: cappedDeductions.earlyTerminationDeduction,
        earlyTerminationDeduction: cappedDeductions.earlyTerminationDeduction,
        otherDeductions: cappedDeductions.otherDeductions,
        totalDeductions: totalAppliedDeductions,
        netRefundAmount,
        remainingDueAmount,
        refundPaymentMethod,
        refundReference,
        settledByUserId: userId,
        settledByUserName: userName,
        notes: notes || (language === "ar" ? "تسوية وبراءة ذمة تأمين مستأجر نهائية" : "Final security deposit settlement & clearance"),
        proofDocumentId: archiveDocId,
      };

      const finalStatus: SecurityDepositStatus = netRefundAmount > 0 ? "REFUNDED" : "SETTLED";

      const historyItem: SecurityDepositHistoryItem = {
        id: \`sd-hist-\${Date.now()}\`,
        date: nowIso,
        action: netRefundAmount > 0 ? "REFUND" : "SETTLEMENT",
        amount: netRefundAmount > 0 ? netRefundAmount : totalHeld,
        performedBy: userName,
        notes: \`تسوية أمانات التأمين: إجمالي المحتجز AED \${totalHeld} - الخصومات AED \${totalDeductions} = صافي المردود AED \${netRefundAmount}\`,
      };

      const updatedLease: Lease = {
        ...lease,
        securityDepositStatus: finalStatus,
        securityDepositSettlement: settlementRecord,
        securityDepositHistory: [...(lease.securityDepositHistory || []), historyItem],
      };

      // Post Double-Entry Journal Entry
      let postedJournal: JournalEntryRecord | undefined = undefined;
      const journalData = buildSecurityDepositSettlementJournal(
        chartOfAccounts,
        {
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          tenantId: lease.tenantId,
          ownerId: lease.ownerId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          totalHeldAmount: totalHeld,
          deductions: cappedDeductions,
          netRefundAmount,
          refundPaymentMethod,
          reference: refundReference,
          transactionDate: todayDate,
          createdBy: userName,
          notes: notes || \`تسوية وبراءة ذمة تأمين مستأجر لعقد #\${lease.leaseNumber}\`,
        }
      );
      const jVal = validateJournalEntry(journalData);
      if (!jVal.isValid) {
        return {
          success: false,
          error: language === "ar"
            ? \`فشل التحقق من القيد المحاسبي: \${jVal.error}\`
            : \`Journal validation failed: \${jVal.error}\`,
        };
      }

      const jeId = "je-sd-ref-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
      const year = new Date().getFullYear();
      const entryNumber = \`JE-\${year}-\${String(journalEntries.length + 1).padStart(5, "0")}\`;
      const journalRecord: JournalEntryRecord = {
        ...journalData,
        id: jeId,
        entryNumber,
        status: "POSTED",
        totalDebit: jVal.totalDebit,
        totalCredit: jVal.totalCredit,
        createdAt: nowIso,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });
      batch.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(journalRecord));
      if (newArchiveRecord) {
        batch.set(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      try {
        await batch.commit();
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to settle/refund security deposit" };
      }

      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));
      setJournalEntries((prev) => [...prev, journalRecord]);
      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord, ...prev]);
      }
      postedJournal = journalRecord;

      logAudit(
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
  console.log("Success replacing refundOrSettleSecurityDeposit");
} else {
  console.log("Target string not found for refundOrSettleSecurityDeposit");
}
