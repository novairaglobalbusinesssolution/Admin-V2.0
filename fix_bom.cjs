const fs = require('fs');
let pkg = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json', 'utf8');
// Replace output directory
pkg = pkg.replace('"output": "C:/temp/dist_installer"', '"output": "C:/temp/dist_installer"');
// Remove BOM if exists
if (pkg.charCodeAt(0) === 0xFEFF) {
  pkg = pkg.slice(1);
}
fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json', pkg, 'utf8');
