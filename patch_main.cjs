const fs = require('fs');
let mainCjsPath = 'D:/Novaira_Upgrade/novaira_v2_admin/frontend/electron/main.cjs';
let mainCjs = fs.readFileSync(mainCjsPath, 'utf8');

mainCjs = mainCjs.replace(
    /require\(backendPath\);/,
    `const backendApp = require(backendPath);
    if (backendApp && typeof backendApp.listen === 'function') {
      const PORT = process.env.PORT || 5000;
      backendApp.listen(PORT, () => {
        console.log('Backend started on port ' + PORT + ' from Electron');
      }).on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          console.log('Port ' + PORT + ' is already in use, assuming backend is already running.');
        } else {
          console.error('Backend listen error:', e);
        }
      });
    }`
);

fs.writeFileSync(mainCjsPath, mainCjs, 'utf8');
console.log('main.cjs updated');
