const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = content.replace(/'http:\/\/localhost:5000(\/[^']*)'/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
            
            // Also handle double quotes if any
            updated = updated.replace(/"http:\/\/localhost:5000(\/[^"]*)"/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");

            if (content !== updated) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log('Updated:', fullPath);
            }
        }
    }
}

processDir('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src/pages');
