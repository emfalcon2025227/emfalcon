import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make postJournalEntry async
content = content.replace(
    'const postJournalEntry = (\n    entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">\n  ): { success: boolean; entry?: JournalEntryRecord; error?: string } => {',
    'const postJournalEntry = async (\n    entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">\n  ): Promise<{ success: boolean; entry?: JournalEntryRecord; error?: string }> => {'
)

# Replace count with allocateNextSequence
content = re.sub(
    r'const count = journalEntries\.length \+ 1;\n\s*const year = new Date\(\)\.getFullYear\(\);\n\s*const entryNumber = `JE-\$\{year\}-\$\{String\(count\)\.padStart\(5, "0"\)\}`;',
    r'const year = new Date().getFullYear();\n    const [entryNumber] = await allocateNextSequence(db, `journal_${year}`, `JE-${year}-`, 1, 5, journalEntries.length);',
    content
)

# Fix interface
content = content.replace(
    'postJournalEntry: (entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">) => { success: boolean; entry?: JournalEntryRecord; error?: string };',
    'postJournalEntry: (entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">) => Promise<{ success: boolean; entry?: JournalEntryRecord; error?: string }>;'
)

# Fix await at line 7266
content = content.replace(
    'const depRes = postJournalEntry(depositJournal);',
    'const depRes = await postJournalEntry(depositJournal);'
)

# Fix await at line 10806
content = content.replace(
    'const result = postJournalEntry(reversalData);',
    'const result = await postJournalEntry(reversalData);'
)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
