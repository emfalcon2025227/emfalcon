const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

const targetAdd = `
    setPropertyExpenses((prev) => [newExpense, ...prev]);
    safeSetDoc(doc(db, "property_expenses", id), newExpense);

    // If linked to a legal case, automatically attach to the case and recalculate
    if (data.legalCaseId) {
      const targetCase = cases.find(c => c.id === data.legalCaseId);
      if (targetCase) {
        const newLinkedIds = Array.from(new Set([...(targetCase.linkedExpenseIds || []), id]));
        const updatedCase = recalculateCaseFinancials(
          { ...targetCase, linkedExpenseIds: newLinkedIds },
          cheques,
          [newExpense, ...propertyExpenses]
        );
        setCases(prev => prev.map(c => c.id === data.legalCaseId ? updatedCase : c));
        safeSetDoc(doc(db, "cases", data.legalCaseId), updatedCase, { merge: true });
        logAudit("LINK_EXPENSE", "CASE", targetCase.id, targetCase.caseNumber, \`تم ربط المصروف القضائي #\${expenseNumber} تلقائياً بالقضية بمبلغ \${totalAmount.toLocaleString()} AED.\`);
      }
    }

    logAudit(
      "CREATE",
      "PROPERTY_EXPENSE",
      id,
      \`مصروف #\${expenseNumber}\`,
      \`تم تسجيل مصروف جديد بمبلغ \${totalAmount.toLocaleString()} AED (\${data.category}) - يتحمله: \${data.costBearer}\`
    );

    const journalData = buildPropertyExpenseJournal(
      {
        expenseId: id,
        expenseNumber,
        totalAmount,
        costBearer: data.costBearer,
        category: data.category,
        transactionDate: data.expenseDate || createdAt,
        paymentMethod: data.paymentMethod,
        ownerId: data.ownerId,
        propertyId: data.propertyId,
        unitId: data.unitId,
        notes: data.notes || data.description,
        createdBy: createdByName,
      },
      chartOfAccounts
    );
    const jRes = postJournalEntry(journalData);
    if (!jRes.success) {
      return {
        success: false,
        error: language === "ar"
          ? \`فشل ترحيل القيد المحاسبي للمصروف: \${jRes.error || "خطأ محاسبي"}\`
          : \`Failed to post property expense journal entry: \${jRes.error || "Accounting error"}\`,
      };
    }

    return { success: true, expense: newExpense };
`;

const replaceAdd = `
    const batch = writeBatch(db);
    batch.set(doc(db, "property_expenses", id), sanitizeForFirestore(newExpense));

    let updatedCase: any = null;
    if (data.legalCaseId) {
      const targetCase = cases.find(c => c.id === data.legalCaseId);
      if (targetCase) {
        const newLinkedIds = Array.from(new Set([...(targetCase.linkedExpenseIds || []), id]));
        updatedCase = recalculateCaseFinancials(
          { ...targetCase, linkedExpenseIds: newLinkedIds },
          cheques,
          [newExpense, ...propertyExpenses]
        );
        batch.set(doc(db, "cases", data.legalCaseId), sanitizeForFirestore(updatedCase), { merge: true });
      }
    }

    let newJournalRecord: JournalEntryRecord | null = null;
    if (newExpense.status === "PAID") {
      const journalData = buildPropertyExpenseJournal(
        {
          expenseId: id,
          expenseNumber,
          totalAmount,
          costBearer: data.costBearer,
          category: data.category,
          transactionDate: data.expenseDate || createdAt,
          paymentMethod: data.paymentMethod,
          ownerId: data.ownerId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          notes: data.notes || data.description,
          createdBy: createdByName,
        },
        chartOfAccounts
      );
      
      const jVal = validateJournalEntry(journalData);
      if (!jVal.isValid) {
        return {
          success: false,
          error: language === "ar" ? \`فشل التحقق من القيد المحاسبي للمصروف: \${jVal.error}\` : \`Journal validation failed: \${jVal.error}\`,
        };
      }
      
      const jeId = "je-exp-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
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
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to commit property expense" };
    }

    setPropertyExpenses((prev) => [newExpense, ...prev]);
    if (updatedCase) {
      setCases(prev => prev.map(c => c.id === data.legalCaseId ? updatedCase : c));
      logAudit("LINK_EXPENSE", "CASE", updatedCase.id, updatedCase.caseNumber, \`تم ربط المصروف القضائي #\${expenseNumber} تلقائياً بالقضية بمبلغ \${totalAmount.toLocaleString()} AED.\`);
    }
    if (newJournalRecord) {
      setJournalEntries(prev => [...prev, newJournalRecord!]);
    }

    logAudit(
      "CREATE",
      "PROPERTY_EXPENSE",
      id,
      \`مصروف #\${expenseNumber}\`,
      \`تم تسجيل مصروف جديد بمبلغ \${totalAmount.toLocaleString()} AED (\${data.category}) - يتحمله: \${data.costBearer}\`
    );

    return { success: true, expense: newExpense };
`;

if (code.includes(targetAdd)) {
  code = code.replace(targetAdd, replaceAdd);
  console.log("Success replacing addPropertyExpense");
} else {
  console.log("Target string not found for addPropertyExpense");
}

const targetSettle = `
    const updated: PropertyExpenseRecord = {
      ...existing,
      status: "PAID",
      paymentMethod,
      transactionReference: transactionReferenceNumber || existing.transactionReference,
      proofDocumentId: archiveDocId || existing.proofDocumentId,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      verifiedByName: userName,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPropertyExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
    safeSetDoc(doc(db, "property_expenses", expenseId), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "PROPERTY_EXPENSE",
      expenseId,
      \`مصروف #\${existing.expenseNumber}\`,
      \`تم تسوية المصروف واعتماده.\${notes ? \` ملاحظات: \${notes}\` : ""}\`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      "Settlement & Verification"
    );

    return { success: true };
`;

const replaceSettle = `
    const updated: PropertyExpenseRecord = {
      ...existing,
      status: "PAID",
      paymentMethod,
      transactionReference: transactionReferenceNumber || existing.transactionReference,
      proofDocumentId: archiveDocId || existing.proofDocumentId,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      verifiedByName: userName,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "property_expenses", expenseId), sanitizeForFirestore(updated), { merge: true });
    
    // Create Journal Entry since it is now PAID
    const journalData = buildPropertyExpenseJournal(
      {
        expenseId: updated.id,
        expenseNumber: updated.expenseNumber,
        totalAmount: updated.totalAmount,
        costBearer: updated.costBearer,
        category: updated.category,
        transactionDate: new Date().toISOString().split("T")[0],
        paymentMethod: updated.paymentMethod,
        ownerId: updated.ownerId,
        propertyId: updated.propertyId,
        unitId: updated.unitId,
        notes: notes || \`تسوية مصروف #\${updated.expenseNumber}\`,
        createdBy: userName,
      },
      chartOfAccounts
    );
    const jVal = validateJournalEntry(journalData);
    if (!jVal.isValid) {
      return {
        success: false,
        error: language === "ar" ? \`فشل التحقق من القيد المحاسبي للمصروف: \${jVal.error}\` : \`Journal validation failed: \${jVal.error}\`,
      };
    }
    const jeId = "je-exp-set-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const year = new Date().getFullYear();
    const entryNumber = \`JE-\${year}-\${String(journalEntries.length + 1).padStart(5, "0")}\`;
    const newJournalRecord: JournalEntryRecord = {
      ...journalData,
      id: jeId,
      entryNumber,
      status: "POSTED",
      totalDebit: jVal.totalDebit,
      totalCredit: jVal.totalCredit,
      createdAt: new Date().toISOString(),
    };
    batch.set(doc(db, "journal_entries", jeId), sanitizeForFirestore(newJournalRecord));

    try {
      await batch.commit();
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to settle property expense." };
    }

    setPropertyExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
    setJournalEntries(prev => [...prev, newJournalRecord]);

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "PROPERTY_EXPENSE",
      expenseId,
      \`مصروف #\${existing.expenseNumber}\`,
      \`تم تسوية المصروف واعتماده.\${notes ? \` ملاحظات: \${notes}\` : ""}\`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      "Settlement & Verification"
    );

    return { success: true };
`;

if (code.includes(targetSettle)) {
  code = code.replace(targetSettle, replaceSettle);
  console.log("Success replacing settlePropertyExpense");
} else {
  console.log("Target string not found for settlePropertyExpense");
}

fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');

