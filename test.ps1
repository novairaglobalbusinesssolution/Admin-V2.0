import re

text = """1. Really enjoyed using this app, the interface is simple and easy to understand, everything works smoothly so far 😊

2. This app has a clean and user-friendly design, the features are easy to find and use, my overall experience has been good.

3. Nice app with a simple and smooth experience, I like how easy it is to navigate, keep improving the app like this ❤️

4. Good experience overall, the app is easy to use and understand, I did not face any major issues.

5. The app looks clean and well organized, navigation is simple and convenient, everything feels quite straightforward 👍"""

lines = text.split('\n')
for line in lines:
    cleaned = line.strip()
    cleaned = re.sub(r'^\s*\d+[\.\)]\s*', '', cleaned)
    if cleaned:
        print("COMMENT:", cleaned)
