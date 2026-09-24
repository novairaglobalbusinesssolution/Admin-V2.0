const fs = require('fs');
let pkg = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json', 'utf8');
pkg = pkg.replace('"output": "C:/temp/dist_installer"', '"output": "dist_installer"');
fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json', pkg, 'utf8');
