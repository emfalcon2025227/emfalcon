const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetStr = `
    const reversalRecord: FinancialReversalRecord = {
      id: \`rev-exp-\${Date.now()}\`,
      reversalNumber: \`REV-EXP-\${Date.now().toString().slice(-6)}\`,
      targetType: "PAYMENT_ALLOCATION",
      targetId: expenseId,
      originalAmount: existing.totalAmount,
      reversedAmount: existing.totalAmount,
      reason,
      reversalDate: new Date().toISOString().slice(0, 10),
      reversalTimestamp: new Date().toISOString(),
      performedByUserId: userId,
      performedByUserName: userName,
      createdAt: new Date().toISOString(),
    };

    setFinancialReversals((prev) => [reversalRecord, ...prev]);
    safeSetDoc(doc(db, "financial_reversals", reversalRecord.id), reversalRecord);

    const updatedExpense: PropertyExpenseRecord = {
      ...existing,
      status: "REVERSED",
    };

    setPropertyExpenses((prev) => prev.map((e) => (e.id === expenseId ? updatedExpense : e)));
    safeSetDoc(doc(db, "property_expenses", expenseId), updatedExpense, { merge: true });

    // Cascade reverse any other expenses generated from the same maintenance invoice
    if ((existing.sourceType as any) === "MAINTENANCE_REQUEST" && existing.maintenanceInvoiceId) {
      const relatedExpenses = propertyExpenses.filter(
        (e) =>
          e.id !== expenseId &&
          (e.sourceType as any) === "MAINTENANCE_REQUEST" &&
          e.maintenanceInvoiceId === existing.maintenanceInvoiceId &&
          e.status !== "REVERSED"
      );

      relatedExpenses.forEach((rel) => {
        const relReversal: FinancialReversalRecord = {
          id: \`rev-exp-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`,
          reversalNumber: \`REV-EXP-\${Date.now().toString().slice(-6)}\`,
          targetType: "PAYMENT_ALLOCATION",
          targetId: rel.id,
          originalAmount: rel.totalAmount,
          reversedAmount: rel.totalAmount,
          reason: \`تراجع تابع بسبب إلغاء المصروف الرئيسي: \${reason}\`,
          reversalDate: new Date().toISOString().slice(0, 10),
          reversalTimestamp: new Date().toISOString(),
          performedByUserId: userId,
          performedByUserName: userName,
          createdAt: new Date().toISOString(),
        };
        setFinancialReversals((prev) => [relReversal, ...prev]);
        safeSetDoc(doc(db, "financial_reversals", relReversal.id), relReversal);

        const updatedRel: PropertyExpenseRecord = {
          ...rel,
          status: "REVERSED",
        };
        setPropertyExpenses((prev) => prev.map((e) => (e.id === rel.id ? updatedRel : e)));
        safeSetDoc(doc(db, "property_expenses", rel.id), updatedRel, { merge: true });
      });
    }

    logAudit(
      "FINANCIAL_REVERSAL",
      "PROPERTY_EXPENSE",
      expenseId,
      \`مصروف #\${existing.expenseNumber}\`,
      \`تم عكس وإلغاء المصروف بمبلغ \${existing.totalAmount.toLocaleString()} AED. السبب: \${reason}\`
    );

    return { success: true };
`;

const replaceStr = `
    const reversalRecord: FinancialReversalRecord = {
      id: \`rev-exp-\${Date.now()}\`,
      reversalNumber: \`REV-EXP-\${Date.now().toString().slice(-6)}\`,
      targetType: "PAYMENT_ALLOCATION",
      targetId: expenseId,
      originalAmount: existing.totalAmount,
      reversedAmount: existing.totalAmount,
      reason,
      reversalDate: new Date().toISOString().slice(0, 10),
      reversalTimestamp: new Date().toISOString(),
      performedByUserId: userId,
      performedByUserName: userName,
      createdAt: new Date().toISOString(),
    };

    const updatedExpense: PropertyExpenseRecord = {
      ...existing,
      status: "REVERSED",
    };

    // Find the original journal entry if it was paid and posted
    let reversalJournal: JournalEntryRecord | null = null;
    const originalJe = journalEntries.find(
      (je) => (je.sourceType === "PROPERTY_EXPENSE" || je.sourceType === "OFFICE_EXPENSE") && je.sourceId === expenseId && je.status === "POSTED"
    );

    const batch = writeBatch(db);
    batch.set(doc(db, "financial_reversals", reversalRecord.id), sanitizeForFirestore(reversalRecord));
    batch.set(doc(db, "property_expenses", expenseId), sanitizeForFirestore(updatedExpense), { merge: true });

    if (originalJe) {
      const revData = buildReversalJournalEntry(originalJe, reason, userName);
      const jVal = validateJournalEntry(revData);
      if (!jVal.isValid) {
        return {
          success: false,
          error: language === "ar" ? \`فشل التحقق من قيد العكس: \${jVal.error}\` : \`Reversal journal validation failed: \${jVal.error}\`
        };
      }
      const jeId = "je-rev-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
      const year = new Date().getFullYear();
      const entryNumber = \`JE-\${year}-\${String(journalEntries.length + 1).padStart(5, "0")}\`;
      reversalJournal = {
        ...revData,
        id: jeId,
        entryNumber,
        status: "POSTED",
        totalDebit: jVal.totalDebit,
        totalCredit: jVal.totalCredit,
        createdAt: new Date().toISOString(),
      };
      batch.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(reversalJournal));
      
      // Mark original as reversed
      batch.set(doc(db, "journal_entries", originalJe.id), sanitizeForFirestore({ ...originalJe, status: "REVERSED" }), { merge: true });
    }

    const relatedUpdates: { rev: FinancialReversalRecord, rel: PropertyExpenseRecord }[] = [];
    if ((existing.sourceType as any) === "MAINTENANCE_REQUEST" && existing.maintenanceInvoiceId) {
      const relatedExpenses = propertyExpenses.filter(
        (e) =>
          e.id !== expenseId &&
          (e.sourceType as any) === "MAINTENANCE_REQUEST" &&
          e.maintenanceInvoiceId === existing.maintenanceInvoiceId &&
          e.status !== "REVERSED"
      );

      relatedExpenses.forEach((rel) => {
        const relReversal: FinancialReversalRecord = {
          id: \`rev-exp-\${Date.now()}-\${crypto.randomUUID().split("-")[0]}\`,
          reversalNumber: \`REV-EXP-\${Date.now().toString().slice(-6)}\`,
          targetType: "PAYMENT_ALLOCATION",
          targetId: rel.id,
          originalAmount: rel.totalAmount,
          reversedAmount: rel.totalAmount,
          reason: \`تراجع تابع بسبب إلغاء المصروف الرئيسي: \${reason}\`,
          reversalDate: new Date().toISOString().slice(0, 10),
          reversalTimestamp: new Date().toISOString(),
          performedByUserId: userId,
          performedByUserName: userName,
          createdAt: new Date().toISOString(),
        };
        const updatedRel: PropertyExpenseRecord = { ...rel, status: "REVERSED" };
        
        batch.set(doc(db, "financial_reversals", relReversal.id), sanitizeForFirestore(relReversal));
        batch.set(doc(db, "property_expenses", rel.id), sanitizeForFirestore(updatedRel), { merge: true });
        relatedUpdates.push({ rev: relReversal, rel: updatedRel });
      });
    }

    try {
      await batch.commit();
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to commit property expense reversal" };
    }

    // Update local state
    setFinancialReversals((prev) => [reversalRecord, ...relatedUpdates.map(u => u.rev), ...prev]);
    setPropertyExpenses((prev) => prev.map((e) => {
      if (e.id === expenseId) return updatedExpense;
      const relMatch = relatedUpdates.find(u => u.rel.id === e.id);
      if (relMatch) return relMatch.rel;
      return e;
    }));
    
    if (originalJe && reversalJournal) {
      setJournalEntries(prev => prev.map(je => je.id === originalJe.id ? { ...je, status: "REVERSED" } : je).concat(reversalJournal!));
    }

    logAudit(
      "FINANCIAL_REVERSAL",
      "PROPERTY_EXPENSE",
      expenseId,
      \`مصروف #\${existing.expenseNumber}\`,
      \`تم عكس وإلغاء المصروف بمبلغ \${existing.totalAmount.toLocaleString()} AED. السبب: \${reason}\`
    );

    return { success: true };
`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
  console.log("Success replacing reversePropertyExpense");
} else {
  console.log("Target string not found for reversePropertyExpense");
}
