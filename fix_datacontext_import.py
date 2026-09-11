import re

with open('src/context/DataContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = 'import { assertCloudWriteAvailable } from "./CloudConnectivityContext";\n'

# Insert it after the first import block
content = re.sub(r'import \{[^}]*\} from "firebase/firestore";', r'\g<0>\n' + import_statement, content)

with open('src/context/DataContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
