import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix settleSecurityDeposit
sec_dep_old = """      const matchedDeposit = dailyDeposits.find(d => d.id === dailyDepositId);
      if (!matchedDeposit) {
        return {
          success: false,
          error: language === "ar" ? "سجل الإيداع اليومي غير موجود." : "Daily deposit record not found.",
        };
      }
      if (matchedDeposit.status !== "VERIFIED" && matchedDeposit.status !== "RECONCILED") {
        return {
          success: false,
          error: language === "ar" ? "سجل الإيداع اليومي المرتبط لم يتم اعتماده." : "The linked daily deposit must be verified.",
        };
      }"""

sec_dep_new = """      const matchedDeposit = dailyDeposits.find(d => d.id === dailyDepositId);
      if (!matchedDeposit) {
        return {
          success: false,
          error: language === "ar" ? "سجل الإيداع اليومي غير موجود." : "Daily deposit record not found.",
        };
      }
      if (matchedDeposit.status !== "VERIFIED" && matchedDeposit.status !== "RECONCILED") {
        return {
          success: false,
          error: language === "ar" ? "سجل الإيداع اليومي المرتبط لم يتم اعتماده." : "The linked daily deposit must be verified.",
        };
      }
      if (matchedDeposit.amount !== existingLease.securityDepositAmount) {
        return { success: false, error: language === "ar" ? "مبلغ الإيداع اليومي لا يطابق التأمين." : "Daily deposit amount mismatch." };
      }
      if (matchedDeposit.category !== "SECURITY_DEPOSIT") {
        return { success: false, error: language === "ar" ? "تصنيف الإيداع اليومي غير صحيح." : "Daily deposit category mismatch." };
      }"""

content = content.replace(sec_dep_old, sec_dep_new)

# Fix settleAdministrativeFee
admin_fee_old = """        verifiedDailyDeposit = targetRecord;
      }

      if (verifiedDailyDeposit.status !== "VERIFIED" && verifiedDailyDeposit.status !== "RECONCILED") {"""

admin_fee_new = """        verifiedDailyDeposit = targetRecord;
      }

      if (verifiedDailyDeposit.status !== "VERIFIED" && verifiedDailyDeposit.status !== "RECONCILED") {
        return {
          success: false,
          error: language === "ar" ? "سجل الإيداع اليومي المرتبط لم يتم اعتماده." : "The linked daily deposit must be verified.",
        };
      }
      if (verifiedDailyDeposit.amount !== existing.outstandingBalance && verifiedDailyDeposit.amount !== existing.grossAmount) {
        return { success: false, error: language === "ar" ? "مبلغ الإيداع اليومي لا يطابق الرسوم." : "Daily deposit amount mismatch." };
      }
      if (verifiedDailyDeposit.category !== "ADMINISTRATIVE_FEE") {"""

content = content.replace(admin_fee_old, admin_fee_new)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
