const fs = require('fs');

// Update package.json
let pkgPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json';
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '2.0.8';
pkg.build.directories.output = 'C:/temp/dist_installer';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('package.json updated to 2.0.8 and output set to temp');

// Update AdminLayout.jsx
let layoutPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/layouts/AdminLayout.jsx';
let layout = fs.readFileSync(layoutPath, 'utf8');
layout = layout.replace(/v2\.0\.7/g, 'v2.0.8');
fs.writeFileSync(layoutPath, layout, 'utf8');
console.log('AdminLayout.jsx updated to v2.0.8');
