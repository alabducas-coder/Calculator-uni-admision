const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const shell = electron.shell;
const path = require('path');

app.setName('Numa Calculadora');

if (process.platform === 'win32' && app.setAppUserModelId) {
  app.setAppUserModelId('com.numa.calculadora');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 390,
    minHeight: 640,
    title: 'Numa Calculadora',
    backgroundColor: '#f1eee6',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  if (mainWindow.webContents.setWindowOpenHandler) {
    mainWindow.webContents.setWindowOpenHandler(function (details) {
      if (/^https?:/i.test(details.url)) shell.openExternal(details.url);
      return { action: 'deny' };
    });
  } else {
    mainWindow.webContents.on('new-window', function (event, url) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
