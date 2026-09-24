const fs = require('fs');
const frontPkg = JSON.parse(fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/package.json', 'utf8'));
const backPkg = JSON.parse(fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/package.json', 'utf8'));

console.log('Front Deps:', Object.keys(frontPkg.dependencies));
console.log('Back Deps:', Object.keys(backPkg.dependencies));

const missing = Object.keys(backPkg.dependencies).filter(d => !frontPkg.dependencies[d]);
console.log('Missing in Front:', missing);
