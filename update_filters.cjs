const fs = require('fs');
let content = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/AddComment.jsx', 'utf8');
content = content.replace(/\.filter\(line => line\.length > 0\)/g, `.filter(line => {
            if (line.length === 0) return false;
            const l = line.toLowerCase();
            if (l.includes("5-star review:")) return false;
            if (l.includes("here are") && l.includes("reviews")) return false;
            return true;
          })`);
fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/AddComment.jsx', content, 'utf8');

let c2 = fs.readFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/CommentsManagement.jsx', 'utf8');
c2 = c2.replace(/\.filter\(line => line\.length > 0\)/g, `.filter(line => {
            if (line.length === 0) return false;
            const l = line.toLowerCase();
            if (l.includes("5-star review:")) return false;
            if (l.includes("here are") && l.includes("reviews")) return false;
            return true;
          })`);
fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages/CommentsManagement.jsx', c2, 'utf8');

console.log("Updated both files");
