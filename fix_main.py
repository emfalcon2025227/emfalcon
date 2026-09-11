import re

with open('src/main.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { ErrorBoundary } from './components/common/ErrorBoundary';",
    "import { ErrorBoundary } from './components/common/ErrorBoundary';\nimport { CloudConnectivityProvider } from './context/CloudConnectivityContext';"
)

content = content.replace(
    "<App />",
    "<CloudConnectivityProvider>\n        <App />\n      </CloudConnectivityProvider>"
)

with open('src/main.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
