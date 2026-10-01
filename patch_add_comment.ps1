import os

file_path = r"src\pages\AddComment.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """      const parseText = (text, rating) => {
        if (!text.trim()) return [];
        return text.split('\n')
          .map(line => {
            const cleaned = line
              .trim()
              .replace(/^\s*(?:[A-Za-z]|\d+)[\).\-:\]\}]\s*/i, '')
              .replace(/^\s*(?:[A-Za-z]|\d+)\s*\.\s*/i, '')
              .replace(/^\s*[-*•✔]\s*/, '')
              .trim();
            return cleaned;
          })
          .filter(line => {
            if (line.length === 0) return false;
            const l = line.toLowerCase();
            if (l.includes("5-star review:")) return false;
            if (l.includes("here are") && l.includes("reviews")) return false;
            return true;
          })
          .map(content => ({
            app_id: selectedApp.id,
            content,
            rating,
            status: 'active'
          }));
      };"""

replacement = """      const parseText = (text, rating) => {
        if (!text.trim()) return [];
        return text.split('\\n')
          .map(line => {
            // Remove ONLY leading numbers/letters followed by punctuation (e.g. "1. ", "a) ", "- ")
            let cleaned = line.trim()
              .replace(/^\\s*(?:\\d+|[A-Za-z])[\\.\\)\\-:]\\s*/i, '')
              .replace(/^\\s*[-*•✔]\\s*/, ''); // Remove bullet points if any
            return cleaned.trim();
          })
          .filter(line => {
            if (line.length === 0) return false;
            
            const l = line.toLowerCase();
            // AI Conversational Filters to block "false/extra" comments
            if (l.includes("here are") && l.includes("review")) return false;
            if (l.includes("here is a")) return false;
            if (l.startsWith("sure!")) return false;
            if (l.startsWith("certainly!")) return false;
            if (l.startsWith("of course")) return false;
            if (l.startsWith("note:")) return false;
            if (l.includes("let me know")) return false;
            if (l.includes("hope these")) return false;
            if (l.includes("feel free to")) return false;
            if (l.includes("5-star review")) return false;
            if (l.match(/^here (are|is) \\d+/)) return false;
            
            return true;
          })
          .map(content => ({
            app_id: selectedApp.id,
            content,
            rating,
            status: 'active'
          }));
      };"""

# I need to be careful with Python's literal regex parsing vs JavaScript string literals.
# But wait, the JavaScript block is literal source code in the JSX file.
# The `target` above might fail due to unicode bullets `•✔` reading slightly differently.

# Let's use regex to replace it dynamically.
import re
pattern = re.compile(r'const parseText = \(text, rating\) => \{.*?status: \'active\'\n\s*\}\)\;\n\s*\};', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(replacement, content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated parseText logic successfully")
else:
    print("Target not found")
