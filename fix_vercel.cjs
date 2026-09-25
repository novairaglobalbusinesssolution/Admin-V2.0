const fs = require('fs');
const content = {
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
};
fs.writeFileSync('D:/Novaira_Upgrade/novaira_v2_admin/frontend/vercel.json', JSON.stringify(content, null, 2), 'utf8');
