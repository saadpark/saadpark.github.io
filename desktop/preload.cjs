const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('saadParkDesktop', {
  minimize: () => ipcRenderer.invoke('saadpark-window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('saadpark-window:toggle-maximize'),
  close: () => ipcRenderer.invoke('saadpark-window:close'),
  onMaximizedChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, maximized) => callback(maximized);
    ipcRenderer.on('saadpark-window:maximized', listener);
    return () => ipcRenderer.removeListener('saadpark-window:maximized', listener);
  },
});
