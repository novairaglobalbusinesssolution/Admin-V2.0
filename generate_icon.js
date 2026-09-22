import pngToIco from 'png-to-ico';
import fs from 'fs';

pngToIco('C:/Users/subha/OneDrive/Desktop/novaira logo/2.0.PNG')
  .then(buf => {
    fs.writeFileSync('public/icon.ico', buf);
    if (!fs.existsSync('build')) fs.mkdirSync('build');
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Icon successfully generated!');
  })
  .catch(console.error);
