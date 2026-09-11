import re

with open('src/components/financials/GeneralLedgerView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'const handlePerformReversal = () => {',
    'const handlePerformReversal = async () => {'
)

content = content.replace(
    'const result = reverseJournalEntry(viewingEntry.id, reversalReason.trim());',
    'const result = await reverseJournalEntry(viewingEntry.id, reversalReason.trim());'
)

with open('src/components/financials/GeneralLedgerView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
