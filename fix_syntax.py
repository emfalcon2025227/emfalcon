import re

with open('src/context/AuthContext.tsx', 'r') as f:
    content = f.read()

# Let's count { and } in the file
opened = content.count('{')
closed = content.count('}')
print("Opened:", opened, "Closed:", closed)
