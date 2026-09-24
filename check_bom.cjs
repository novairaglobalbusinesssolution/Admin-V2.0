const fs = require('fs');
let content = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/main.jsx', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/main.jsx', content, 'utf8');
  console.log("BOM removed from main.jsx");
} else {
  console.log("No BOM found in main.jsx");
}
