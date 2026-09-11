const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetStr = `
      await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "owner_transfers", transferId);
        const ownerRef = doc(db, "owners", existing.ownerId);

        const transferSnap = await transaction.get(transferRef);
        const ownerSnap = await transaction.get(ownerRef);

        if (!transferSnap.exists()) throw new Error("Transfer not found.");
        const transferData = transferSnap.data() as OwnerTransferRecord;
        
        if (["PAID", "COMPLETED", "RECONCILED", "CANCELLED", "REVERSED"].includes(transferData.status) || transferData.isReversed) {
          throw new Error("Transfer is already settled or locked.");
        }

        const currentHeld = ownerSnap.data()?.totalHeld || 0;
        const currentPaid = ownerSnap.data()?.totalPaid || 0;

        // Atomic update of counters
        const updateOwnerFields: any = {
           totalPaid: currentPaid + transferData.amount
        };

        // If it was held (status APPROVED), release the hold
        if (transferData.status === "APPROVED") {
            updateOwnerFields.totalHeld = Math.max(0, currentHeld - transferData.amount);
        }

        transaction.update(ownerRef, updateOwnerFields);

        if (newArchiveRecord) {
           const archiveRef = doc(db, "archive", newArchiveRecord.id);
           transaction.set(archiveRef, sanitizeForFirestore(newArchiveRecord));
        }
        
        const finalVerificationStatus = verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED");
        const finalVerificationMethod = verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE");

        transaction.update(transferRef, sanitizeForFirestore({
           status: "PAID",
           paidByUserId: userId,
           paidByUserName: userName,
           approvedByUserId: transferData.approvedByUserId || userId,
           approvedByUserName: transferData.approvedByUserName || userName,
           proofDocumentId: archiveDocId,
           transactionReferenceNumber: transactionReferenceNumber || transferData.transactionReferenceNumber,
           notes: notes ? (transferData.notes ? \`\${transferData.notes} | \${notes}\` : notes) : transferData.notes,
           updatedAt: new Date().toISOString(),
           settledAt: new Date().toISOString(),
           settledByUserId: userId,
           settledByName: userName,
           verificationStatus: finalVerificationStatus,
           verificationMethod: finalVerificationMethod,
           overrideReason: overrideReason || null,
           overrideType: overrideType || null,
           verifiedByUserId: userId,
           verifiedByName: userName,
           verifiedAt: new Date().toISOString(),
           aiVerificationDetails: aiVerificationDetails || null,
        }));
      });

      // Update local state
      const updatedTransfer: OwnerTransferRecord = {
          ...existing,
          status: "PAID" as OwnerTransferStatus,
          paidByUserId: userId,
          paidByUserName: userName,
          approvedByUserId: existing.approvedByUserId || userId,
          approvedByUserName: existing.approvedByUserName || userName,
          proofDocumentId: archiveDocId,
          transactionReferenceNumber: transactionReferenceNumber || existing.transactionReferenceNumber,
          notes: notes ? (existing.notes ? \`\${existing.notes} | \${notes}\` : notes) : existing.notes,
          updatedAt: new Date().toISOString(),
          settledAt: new Date().toISOString(),
          settledByUserId: userId,
          settledByName: userName,
          verificationStatus: verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED"),
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          overrideReason: overrideReason,
          overrideType: overrideType,
          verifiedByUserId: userId,
          verifiedByName: userName,
          verifiedAt: new Date().toISOString(),
          aiVerificationDetails: aiVerificationDetails,
      };

      setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updatedTransfer : t)));
      if (newArchiveRecord) {
         setArchive(prev => [newArchiveRecord!, ...prev]);
      }
      setOwners(prev => prev.map(o => o.id === existing.ownerId ? {
          ...o,
          totalHeld: Math.max(0, (o.totalHeld || 0) - existing.amount),
          totalPaid: (o.totalPaid || 0) + existing.amount
      } : o));

      // AI Verification & Manual Override Audit Log
      if (verificationStatus) {
        const auditRec = buildVerificationAuditRecord({
          transactionId: existing.id,
          entityType: "OWNER_TRANSFER",
          entityName: \`تحويل مالك #\${existing.transferNumber} بمبلغ \${existing.amount.toLocaleString()} AED\`,
          proofDocumentId: archiveDocId,
          proofFileName: proofFileName,
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          previousVerificationStatus: existing.verificationStatus || "UNVERIFIED",
          aiStatus: aiVerificationDetails?.aiStatus || (verificationStatus === "AI_VERIFIED" ? "MATCH" : "FAILED"),
          aiExtractedValues: aiVerificationDetails?.extractedValues || {},
          expectedValues: aiVerificationDetails?.expectedValues || { amount: existing.amount },
          comparisonResults: aiVerificationDetails?.comparisonResults || {},
          overrideReason: overrideReason,
          overrideType: overrideType,
          userId,
          userName,
          userRole: currentUser?.role || "SUPER_ADMIN",
          finalStatus: verificationStatus,
        });

        logAudit(
          auditRec.action,
          auditRec.entityType,
          auditRec.entityId,
          auditRec.entityName,
          auditRec.details,
          auditRec.oldValue,
          auditRec.newValue,
          auditRec.reason
        );
      }

      logAudit(
        "FINANCIAL_POSTING",
        "OWNER_TRANSFER",
        transferId,
        \`تحويل #\${existing.transferNumber}\`,
        \`تم إثبات الإيداع والتسوية المالية بنجاح بمبلغ \${existing.amount.toLocaleString()} AED - مرجع: \${updatedTransfer.transactionReferenceNumber || "لا يوجد"}\`
      );

      const journalData = buildOwnerTransferJournal(
        {
          transferId: existing.id,
          transferNumber: existing.transferNumber,
          amount: existing.amount,
          transactionDate: existing.transferDate || new Date().toISOString().split("T")[0],
          ownerId: existing.ownerId,
          bankAccountReference: updatedTransfer.transactionReferenceNumber,
          createdBy: userName,
          notes: notes || existing.notes,
        },
        chartOfAccounts
      );
      const jRes = postJournalEntry(journalData);
      if (!jRes.success) {
        return {
          success: false,
          error: language === "ar"
            ? \`فشل ترحيل القيد المحاسبي لتحويل المالك: \${jRes.error || "خطأ محاسبي"}\`
            : \`Failed to post owner transfer journal entry: \${jRes.error || "Accounting error"}\`,
        };
      }

      return { success: true };
`;

const replaceStr = `
      const txResult = await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "owner_transfers", transferId);
        const ownerRef = doc(db, "owners", existing.ownerId);

        const transferSnap = await transaction.get(transferRef);
        const ownerSnap = await transaction.get(ownerRef);

        if (!transferSnap.exists()) throw new Error("Transfer not found.");
        const transferData = transferSnap.data() as OwnerTransferRecord;
        
        if (["PAID", "COMPLETED", "RECONCILED", "CANCELLED", "REVERSED"].includes(transferData.status) || transferData.isReversed) {
          throw new Error("Transfer is already settled or locked.");
        }

        const currentHeld = ownerSnap.data()?.totalHeld || 0;
        const currentPaid = ownerSnap.data()?.totalPaid || 0;

        // Atomic update of counters
        const updateOwnerFields: any = {
           totalPaid: currentPaid + transferData.amount
        };

        // If it was held (status APPROVED), release the hold
        if (transferData.status === "APPROVED") {
            updateOwnerFields.totalHeld = Math.max(0, currentHeld - transferData.amount);
        }

        transaction.update(ownerRef, updateOwnerFields);

        if (newArchiveRecord) {
           const archiveRef = doc(db, "archive", newArchiveRecord.id);
           transaction.set(archiveRef, sanitizeForFirestore(newArchiveRecord));
        }
        
        const finalVerificationStatus = verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED");
        const finalVerificationMethod = verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE");

        transaction.update(transferRef, sanitizeForFirestore({
           status: "PAID",
           paidByUserId: userId,
           paidByUserName: userName,
           approvedByUserId: transferData.approvedByUserId || userId,
           approvedByUserName: transferData.approvedByUserName || userName,
           proofDocumentId: archiveDocId,
           transactionReferenceNumber: transactionReferenceNumber || transferData.transactionReferenceNumber,
           notes: notes ? (transferData.notes ? \`\${transferData.notes} | \${notes}\` : notes) : transferData.notes,
           updatedAt: new Date().toISOString(),
           settledAt: new Date().toISOString(),
           settledByUserId: userId,
           settledByName: userName,
           verificationStatus: finalVerificationStatus,
           verificationMethod: finalVerificationMethod,
           overrideReason: overrideReason || null,
           overrideType: overrideType || null,
           verifiedByUserId: userId,
           verifiedByName: userName,
           verifiedAt: new Date().toISOString(),
           aiVerificationDetails: aiVerificationDetails || null,
        }));
        
        // Build and Validate Journal Entry inside the transaction
        const journalData = buildOwnerTransferJournal(
          {
            transferId: existing.id,
            transferNumber: existing.transferNumber,
            amount: existing.amount,
            transactionDate: existing.transferDate || new Date().toISOString().split("T")[0],
            ownerId: existing.ownerId,
            bankAccountReference: transactionReferenceNumber || transferData.transactionReferenceNumber,
            createdBy: userName,
            notes: notes || existing.notes,
          },
          chartOfAccounts
        );
        const jVal = validateJournalEntry(journalData);
        if (!jVal.isValid) {
          throw new Error(language === "ar" ? \`فشل التحقق من القيد المحاسبي: \${jVal.error}\` : \`Journal validation failed: \${jVal.error}\`);
        }
        const jeId = "je-ot-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
        const year = new Date().getFullYear();
        // Since we are inside a runTransaction, we cannot safely predict the exact length if multiple journals are added concurrently, but this is a reasonable approximation for memory
        const entryNumber = \`JE-\${year}-\${String(journalEntries.length + 1).padStart(5, "0")}\`;
        const journalRecord: JournalEntryRecord = {
          ...journalData,
          id: jeId,
          entryNumber,
          status: "POSTED",
          totalDebit: jVal.totalDebit,
          totalCredit: jVal.totalCredit,
          createdAt: new Date().toISOString(),
        };
        transaction.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(journalRecord));
        
        return { journalRecord };
      });

      // Update local state
      const updatedTransfer: OwnerTransferRecord = {
          ...existing,
          status: "PAID" as OwnerTransferStatus,
          paidByUserId: userId,
          paidByUserName: userName,
          approvedByUserId: existing.approvedByUserId || userId,
          approvedByUserName: existing.approvedByUserName || userName,
          proofDocumentId: archiveDocId,
          transactionReferenceNumber: transactionReferenceNumber || existing.transactionReferenceNumber,
          notes: notes ? (existing.notes ? \`\${existing.notes} | \${notes}\` : notes) : existing.notes,
          updatedAt: new Date().toISOString(),
          settledAt: new Date().toISOString(),
          settledByUserId: userId,
          settledByName: userName,
          verificationStatus: verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED"),
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          overrideReason: overrideReason,
          overrideType: overrideType,
          verifiedByUserId: userId,
          verifiedByName: userName,
          verifiedAt: new Date().toISOString(),
          aiVerificationDetails: aiVerificationDetails,
      };

      setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updatedTransfer : t)));
      if (newArchiveRecord) {
         setArchive(prev => [newArchiveRecord!, ...prev]);
      }
      setOwners(prev => prev.map(o => o.id === existing.ownerId ? {
          ...o,
          totalHeld: Math.max(0, (o.totalHeld || 0) - existing.amount),
          totalPaid: (o.totalPaid || 0) + existing.amount
      } : o));
      
      setJournalEntries(prev => [...prev, txResult.journalRecord]);

      // AI Verification & Manual Override Audit Log
      if (verificationStatus) {
        const auditRec = buildVerificationAuditRecord({
          transactionId: existing.id,
          entityType: "OWNER_TRANSFER",
          entityName: \`تحويل مالك #\${existing.transferNumber} بمبلغ \${existing.amount.toLocaleString()} AED\`,
          proofDocumentId: archiveDocId,
          proofFileName: proofFileName,
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          previousVerificationStatus: existing.verificationStatus || "UNVERIFIED",
          aiStatus: aiVerificationDetails?.aiStatus || (verificationStatus === "AI_VERIFIED" ? "MATCH" : "FAILED"),
          aiExtractedValues: aiVerificationDetails?.extractedValues || {},
          expectedValues: aiVerificationDetails?.expectedValues || { amount: existing.amount },
          comparisonResults: aiVerificationDetails?.comparisonResults || {},
          overrideReason: overrideReason,
          overrideType: overrideType,
          userId,
          userName,
          userRole: currentUser?.role || "SUPER_ADMIN",
          finalStatus: verificationStatus,
        });

        logAudit(
          auditRec.action,
          auditRec.entityType,
          auditRec.entityId,
          auditRec.entityName,
          auditRec.details,
          auditRec.oldValue,
          auditRec.newValue,
          auditRec.reason
        );
      }

      logAudit(
        "FINANCIAL_POSTING",
        "OWNER_TRANSFER",
        transferId,
        \`تحويل #\${existing.transferNumber}\`,
        \`تم إثبات الإيداع والتسوية المالية بنجاح بمبلغ \${existing.amount.toLocaleString()} AED - مرجع: \${updatedTransfer.transactionReferenceNumber || "لا يوجد"}\`
      );

      return { success: true };
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
  console.log("Success replacing settleOwnerTransfer");
} else {
  console.log("Target string not found for settleOwnerTransfer");
}
