import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

imports_to_remove = [
    "INITIAL_OWNERS,",
    "INITIAL_PROPERTIES,",
    "INITIAL_UNITS,",
    "INITIAL_TENANTS,",
    "INITIAL_LEASES,",
    "INITIAL_CHEQUES,",
    "INITIAL_COLLECTIONS,",
    "INITIAL_CASES,",
    "INITIAL_ARCHIVE,",
    "INITIAL_NOTIFICATIONS,",
    "INITIAL_AUDIT_LOGS,",
    "INITIAL_HISTORICAL_RECORDS,",
    "INITIAL_MAINTENANCE_REQUESTS,",
    "INITIAL_TECHNICIANS,"
]

for imp in imports_to_remove:
    content = content.replace(imp, "")

# Remove blank lines
content = re.sub(r'\n\s*\n', '\n', content)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
