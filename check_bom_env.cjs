const fs = require('fs');
let content = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/.env', content, 'utf8');
  console.log("BOM removed from .env");
} else {
  console.log("No BOM found in .env");
}
