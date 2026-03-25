const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('invoiceApp', {
  savePdf: (options) => ipcRenderer.invoke('invoice:save-pdf', options),
  exportBackup: (options) => ipcRenderer.invoke('invoice:export-backup', options),
  importBackup: () => ipcRenderer.invoke('invoice:import-backup'),
  onMenuSavePdf: (callback) => {
    ipcRenderer.on('invoice:menu-save-pdf', callback);
  },
  onMenuExportBackup: (callback) => {
    ipcRenderer.on('invoice:menu-export-backup', callback);
  },
  onMenuImportBackup: (callback) => {
    ipcRenderer.on('invoice:menu-import-backup', callback);
  }
});
