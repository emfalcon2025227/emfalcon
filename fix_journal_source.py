import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix settleSecurityDeposit
sec_old = """        const journalData = buildBankDepositJournal(
          {
            sourceType: "SECURITY_DEPOSIT",
            sourceId: existingLease.id,
"""
sec_new = """        const journalData = buildBankDepositJournal(
          {
            sourceType: "DAILY_DEPOSIT",
            sourceId: dailyDepositId!,
"""
content = content.replace(sec_old, sec_new)

# Fix settleAdministrativeFee
adm_old = """        const journalData = buildBankDepositJournal(
          {
            sourceType: "ADMINISTRATIVE_FEE",
            sourceId: commissionId,
"""
adm_new = """        const journalData = buildBankDepositJournal(
          {
            sourceType: effectivePaymentMethod === "CASH" && dailyDepositId ? "DAILY_DEPOSIT" : "ADMINISTRATIVE_FEE",
            sourceId: effectivePaymentMethod === "CASH" && dailyDepositId ? dailyDepositId : commissionId,
"""
content = content.replace(adm_old, adm_new)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
