const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            // Revert `${import.meta.env.VITE_API_URL}` back to http://localhost:5000
            content = content.replace(/\`\$\{import\.meta\.env\.VITE_API_URL\}/g, "'http://localhost:5000");
            
            // Because my previous regex turned 'http://.../api' into `${import.meta.env.VITE_API_URL}/api`,
            // reverting it will turn it into 'http://localhost:5000/api` (notice the backtick at the end)
            // So we need to fix the ending backtick into a single quote.
            content = content.replace(/'http:\/\/localhost:5000(.*?)`/g, "'http://localhost:5000$1'");

            if (original !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Reverted ${fullPath}`);
            }
        }
    });
}

replaceInDir('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src');
