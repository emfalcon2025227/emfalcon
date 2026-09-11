const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetStr = `
      setCollections((prev) => [newReceipt, ...prev]);
      setPaymentAllocations((prev) => [newAllocation, ...prev]);
      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));

      safeSetDoc(doc(db, "collections", receiptId), sanitizeForFirestore(newReceipt));
      safeSetDoc(doc(db, "payment_allocations", allocationId), sanitizeForFirestore(newAllocation));
      safeSetDoc(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });

      // Post Double-Entry Journal Entry: Debit Asset, Credit 2020
      let postedJournal: JournalEntryRecord | undefined = undefined;
      const journalData = buildSecurityDepositCollectionJournal(
        chartOfAccounts,
        {
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          tenantId: lease.tenantId,
          ownerId: lease.ownerId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          amount,
          paymentMethod,
          receiptNumber,
          chequeNumber,
          bankName,
          transactionDate: todayDate,
          createdBy: userName,
          notes: notes || \`تحصيل أمانات تأمين صيانة مستأجر لعقد إيجار #\${lease.leaseNumber} (حساب 2020)\`,
        }
      );
      const jRes = postJournalEntry(journalData);
      if (!jRes.success || !jRes.entry) {
        return {
          success: false,
          error: language === "ar"
            ? \`فشل ترحيل القيد المحاسبي لأمانات التأمين: \${jRes.error || "خطأ محاسبي"}\`
            : \`Failed to post security deposit journal entry: \${jRes.error || "Accounting error"}\`,
        };
      }
      postedJournal = jRes.entry;
`;

const replaceStr = `
      const journalData = buildSecurityDepositCollectionJournal(
        chartOfAccounts,
        {
          leaseId: lease.id,
          leaseNumber: lease.leaseNumber,
          tenantId: lease.tenantId,
          ownerId: lease.ownerId,
          propertyId: lease.propertyId,
          unitId: lease.unitId,
          amount,
          paymentMethod,
          receiptNumber,
          chequeNumber,
          bankName,
          transactionDate: todayDate,
          createdBy: userName,
          notes: notes || \`تحصيل أمانات تأمين صيانة مستأجر لعقد إيجار #\${lease.leaseNumber} (حساب 2020)\`,
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

      const jeId = "je-sd-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
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
      batch.set(doc(db, "collections", receiptId), sanitizeForFirestore(newReceipt));
      batch.set(doc(db, "payment_allocations", allocationId), sanitizeForFirestore(newAllocation));
      batch.set(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });
      batch.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(journalRecord));
      if (newArchiveRecord) {
        batch.set(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      try {
        await batch.commit();
      } catch (e: any) {
        return { success: false, error: e?.message || "Failed to commit security deposit collection" };
      }

      setCollections((prev) => [newReceipt, ...prev]);
      setPaymentAllocations((prev) => [newAllocation, ...prev]);
      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));
      setJournalEntries((prev) => [...prev, journalRecord]);
      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord, ...prev]);
      }
      
      let postedJournal = journalRecord;
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
  console.log("Success replacing collectSecurityDeposit");
} else {
  console.log("Target string not found for collectSecurityDeposit");
}

