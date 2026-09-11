import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'const reverseJournalEntry = (\n    id: string,\n    reason: string\n  ): { success: boolean; reversalEntry?: JournalEntryRecord; error?: string } => {',
    'const reverseJournalEntry = async (\n    id: string,\n    reason: string\n  ): Promise<{ success: boolean; reversalEntry?: JournalEntryRecord; error?: string }> => {'
)

# And fix the DataContext interface
content = content.replace(
    'reverseJournalEntry: (id: string, reason: string) => { success: boolean; reversalEntry?: JournalEntryRecord; error?: string };',
    'reverseJournalEntry: (id: string, reason: string) => Promise<{ success: boolean; reversalEntry?: JournalEntryRecord; error?: string }>;'
)


with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
