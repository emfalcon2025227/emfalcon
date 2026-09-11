import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'allocateNextSequence' not in content:
    content = content.replace(
        'import {', 
        'import { allocateNextSequence } from "../utils/sequenceGenerator";\nimport {',
        1
    )

# Standard entryNumber replacement
content = re.sub(
    r'const entryNumber = `JE-\$\{year\}-\$\{String\(journalEntries\.length \+ 1\)\.padStart\(5, "0"\)\}`;',
    r'const [entryNumber] = await allocateNextSequence(db, `journal_${year}`, `JE-${year}-`, 1, 5, journalEntries.length);',
    content
)

# For the complex rentEntryNumber
content = re.sub(
    r'const rentEntryNumber = `JE-\$\{year\}-\$\{String\(journalEntries\.length \+ 1\)\.padStart\(5, "0"\)\}`;',
    r'const [rentEntryNumber] = await allocateNextSequence(db, `journal_${year}`, `JE-${year}-`, 1, 5, journalEntries.length);',
    content
)

# For the commEntryNumber
content = re.sub(
    r'const commEntryNumber = `JE-\$\{year\}-\$\{String\(journalEntries\.length \+ \(rentJournalRecord \? 2 : 1\)\)\.padStart\(5, "0"\)\}`;',
    r'const [commEntryNumber] = await allocateNextSequence(db, `journal_${year}`, `JE-${year}-`, 1, 5, journalEntries.length + (rentJournalRecord ? 1 : 0));',
    content
)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
