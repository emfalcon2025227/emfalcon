import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add source linkage match for Security Deposit
content = content.replace(
    'if (matchedDeposit.category !== "SECURITY_DEPOSIT") {',
    'if (matchedDeposit.sourceId !== existingLease.id) {\n        return { success: false, error: language === "ar" ? "الإيداع اليومي غير مرتبط بهذا العقد." : "Daily deposit linkage mismatch." };\n      }\n      if (matchedDeposit.category !== "SECURITY_DEPOSIT") {'
)

# Add source linkage match for Admin Fee
content = content.replace(
    'if (verifiedDailyDeposit.category !== "ADMINISTRATIVE_FEE") {',
    'if (verifiedDailyDeposit.sourceId !== existing.id) {\n        return { success: false, error: language === "ar" ? "الإيداع اليومي غير مرتبط بهذه الرسوم." : "Daily deposit linkage mismatch." };\n      }\n      if (verifiedDailyDeposit.category !== "ADMINISTRATIVE_FEE") {'
)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
