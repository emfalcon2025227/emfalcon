import re

funcs = [
    "allocatePaymentToTargets",
    "addFinancialAdjustment",
    "postAction",
    "updateAction",
    "recordPaymentPromise",
    "updatePaymentPromise"
]

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

for func in funcs:
    parts = content.split(f'const {func} = async')
    if len(parts) > 1:
        subparts = parts[1].split('=> {', 1)
        if len(subparts) > 1:
            parts[1] = subparts[0] + '=> {\n    assertCloudWriteAvailable(language as "ar" | "en");' + subparts[1]
            content = f'const {func} = async'.join(parts)
            print(f"Injected into {func}")
        else:
            print(f"Could not find arrow for {func}")
    else:
        print(f"Could not find {func}")

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
