const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledgerApp', {
  loadData: () => ipcRenderer.invoke('ledger:load-data'),
  saveData: (payload) => ipcRenderer.invoke('ledger:save-data', payload),
  exportBackup: (options) => ipcRenderer.invoke('ledger:export-backup', options),
  importBackup: () => ipcRenderer.invoke('ledger:import-backup'),
  revealDataFile: () => ipcRenderer.invoke('ledger:reveal-data-file'),
  onMenuExportBackup: (callback) => {
    ipcRenderer.on('ledger:menu-export-backup', callback);
  },
  onMenuImportBackup: (callback) => {
    ipcRenderer.on('ledger:menu-import-backup', callback);
  },
  onMenuRevealDataFile: (callback) => {
    ipcRenderer.on('ledger:menu-reveal-data-file', callback);
  }
});
