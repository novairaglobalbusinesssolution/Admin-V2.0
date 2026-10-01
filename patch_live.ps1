import os

file_path = r"src\pages\LiveListManagement.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = "const toMarkNotLive = members.filter(m => !selectedIds.includes(m.id) && m.status === 'Live');"
replacement = "const toMarkNotLive = members.filter(m => !selectedIds.includes(m.id) && m.status !== 'Not Live');"

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed toMarkNotLive to include Under Review users")
else:
    print("Target not found")
