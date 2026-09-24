const fs = require('fs');
const content = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/backend/index.js', 'utf8');
const regex = /require\(['"]([^'"]+)['"]\)/g;
let match;
const reqs = new Set();
while ((match = regex.exec(content)) !== null) {
    if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
        reqs.add(match[1]);
    }
}
console.log('All external requires:', Array.from(reqs));
