const fs = require('fs');

// Update package.json
let pkgPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json';
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '2.1.0';
pkg.build.directories.output = 'C:/temp/dist_installer';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

// Update AdminLayout.jsx
let layoutPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/layouts/AdminLayout.jsx';
let layout = fs.readFileSync(layoutPath, 'utf8');
layout = layout.replace(/v2\.0\.9/g, 'v2.1.0');
fs.writeFileSync(layoutPath, layout, 'utf8');
console.log('Bumped to 2.1.0');
