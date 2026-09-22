const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function startBackend() {
  try {
    const backendPath = path.join(__dirname, '../backend/index.js');
    console.log('Loading backend directly into Electron main process:', backendPath);
    // require it directly, no fork!
    require(backendPath);
    console.log('Backend loaded successfully.');
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    title: "NOVAIRA ADMIN",
    icon: path.join(__dirname, '../public/icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
