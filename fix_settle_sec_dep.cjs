const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetStr = `
      // Update lease verification metadata
      const updatedLeaseData: Partial<Lease> = {
        securityDepositStatus: "HELD",
        securityDepositProofDocId: archiveDocId || existingLease.securityDepositProofDocId,
        securityDepositVerificationStatus: verificationStatus || "VERIFIED",
      };

      setLeases((prev) =>
        prev.map((l) => (l.id === leaseId ? { ...l, ...updatedLeaseData } : l))
      );
      safeSetDoc(doc(db, "leases", leaseId), updatedLeaseData, { merge: true });

      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord!, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      if (existingLease.securityDepositPaymentMethod === "CASH" && updatedLeaseData.securityDepositVerificationStatus === "VERIFIED") {
        const journalData = buildBankDepositJournal(
          {
            sourceType: "SECURITY_DEPOSIT",
            sourceId: existingLease.id,
            totalAmount: existingLease.securityDeposit || 0,
            transactionDate: new Date().toISOString().split("T")[0],
            referenceNumber: transactionReferenceNumber || existingLease.securityDepositReceiptNumber,
            notes: notes || \`إيداع بنكي لتأمين نقدي محصل لعقد #\${existingLease.leaseNumber}\`,
            createdBy: userName,
          },
          chartOfAccounts
        );
        const depRes = postJournalEntry(journalData);
        if (!depRes.success) {
          return {
            success: false,
            error: language === "ar"
              ? \`فشل ترحيل قيد الإيداع البنكي لتأمين الصيانة النقدي: \${depRes.error || "خطأ محاسبي"}\`
              : \`Failed to post bank deposit journal for cash deposit: \${depRes.error || "Accounting error"}\`,
          };
        }
      }
`;

const replaceStr = `
      // Update lease verification metadata
      const updatedLeaseData: Partial<Lease> = {
        securityDepositStatus: "HELD",
        securityDepositProofDocId: archiveDocId || existingLease.securityDepositProofDocId,
        securityDepositVerificationStatus: verificationStatus || "VERIFIED",
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLeaseData), { merge: true });

      if (newArchiveRecord) {
        batch.set(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      let newJournalRecord: JournalEntryRecord | null = null;
      if (existingLease.securityDepositPaymentMethod === "CASH" && updatedLeaseData.securityDepositVerificationStatus === "VERIFIED") {
        const journalData = buildBankDepositJournal(
          {
            sourceType: "SECURITY_DEPOSIT",
            sourceId: existingLease.id,
            totalAmount: existingLease.securityDeposit || 0,
            transactionDate: new Date().toISOString().split("T")[0],
            referenceNumber: transactionReferenceNumber || existingLease.securityDepositReceiptNumber,
            notes: notes || \`إيداع بنكي لتأمين نقدي محصل لعقد #\${existingLease.leaseNumber}\`,
            createdBy: userName,
          },
          chartOfAccounts
        );
        const jVal = validateJournalEntry(journalData);
        if (!jVal.isValid) {
          return {
            success: false,
            error: language === "ar"
              ? \`فشل التحقق من قيد الإيداع البنكي: \${jVal.error}\`
              : \`Bank deposit journal validation failed: \${jVal.error}\`,
          };
        }
        
        const jeId = "je-sd-dep-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
        const year = new Date().getFullYear();
        const entryNumber = \`JE-\${year}-\${String(journalEntries.length + 1).padStart(5, "0")}\`;
        newJournalRecord = {
          ...journalData,
          id: jeId,
          entryNumber,
          status: "POSTED",
          totalDebit: jVal.totalDebit,
          totalCredit: jVal.totalCredit,
          createdAt: new Date().toISOString(),
        };
        batch.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(newJournalRecord));
      }

      try {
        await batch.commit();
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to settle security deposit." };
      }

      setLeases((prev) =>
        prev.map((l) => (l.id === leaseId ? { ...l, ...updatedLeaseData } : l))
      );
      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord!, ...prev]);
      }
      if (newJournalRecord) {
        setJournalEntries((prev) => [...prev, newJournalRecord!]);
      }
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
  console.log("Success replacing settleSecurityDeposit");
} else {
  console.log("Target string not found for settleSecurityDeposit");
}
