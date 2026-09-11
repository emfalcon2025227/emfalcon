import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix securityDepositAmount -> securityDeposit
content = content.replace('existingLease.securityDepositAmount', 'existingLease.securityDeposit')

# Fix matchedDeposit.category -> matchedDeposit.paymentSource
content = content.replace('matchedDeposit.category !== "SECURITY_DEPOSIT"', 'matchedDeposit.paymentSource !== "SECURITY_DEPOSIT"')

# Fix admin fee category -> paymentSource
# Let's find how we wrote it in admin fee:
# if (verifiedDailyDeposit.category !== "ADMINISTRATIVE_FEE") {
content = content.replace('if (verifiedDailyDeposit.category !== "ADMINISTRATIVE_FEE") {', 'if (verifiedDailyDeposit.paymentSource !== "OTHER" && verifiedDailyDeposit.paymentSource !== "COLLECTION") {')


with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
