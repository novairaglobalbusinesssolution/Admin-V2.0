const fs = require('fs');
let pkgPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json';
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.build.directories.output = 'dist_installer';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('package.json output restored');
