const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Saad Park',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    // The caption is rendered by the application for a Unity-Hub-like look.
    frame: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const notifyWindowState = () => window.webContents.send('saadpark-window:maximized', window.isMaximized());
  window.on('maximize', notifyWindowState);
  window.on('unmaximize', notifyWindowState);

  window.loadFile(path.join(__dirname, '..', 'index.html'));
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle('saadpark-window:minimize', (event) => getWindow(event)?.minimize());
ipcMain.handle('saadpark-window:toggle-maximize', (event) => {
  const window = getWindow(event);
  if (!window) return false;
  if (window.isMaximized()) window.unmaximize(); else window.maximize();
  return window.isMaximized();
});
ipcMain.handle('saadpark-window:close', (event) => getWindow(event)?.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
