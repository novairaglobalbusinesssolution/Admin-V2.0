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
            // Replace 'http://localhost:5000/api...' with `${import.meta.env.VITE_API_URL}/api...`
            content = content.replace(/'http:\/\/localhost:5000/g, '`${import.meta.env.VITE_API_URL}');
            content = content.replace(/"http:\/\/localhost:5000/g, '`${import.meta.env.VITE_API_URL}');
            
            // This regex fixes cases where it replaces string literals but doesn't add closing backtick
            // For example: fetch('http://localhost:5000/api/send') -> fetch(`${import.meta.env.VITE_API_URL}/api/send`)
            content = content.replace(/`\$\{import\.meta\.env\.VITE_API_URL\}(.*?)['"]/g, '`${import.meta.env.VITE_API_URL}$1`');

            if (original !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    });
}

replaceInDir('D:/Novaira_Upgrade/novaira_v2_admin/frontend/src');
