const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coinLedgerApp', {
  loadData: () => ipcRenderer.invoke('coin-ledger:load-data'),
  saveData: (payload) => ipcRenderer.invoke('coin-ledger:save-data', payload),
  exportBackup: (options) => ipcRenderer.invoke('coin-ledger:export-backup', options),
  importBackup: () => ipcRenderer.invoke('coin-ledger:import-backup'),
  revealDataFile: () => ipcRenderer.invoke('coin-ledger:reveal-data-file'),
  onMenuExportBackup: (callback) => {
    ipcRenderer.on('coin-ledger:menu-export-backup', callback);
  },
  onMenuImportBackup: (callback) => {
    ipcRenderer.on('coin-ledger:menu-import-backup', callback);
  },
  onMenuRevealDataFile: (callback) => {
    ipcRenderer.on('coin-ledger:menu-reveal-data-file', callback);
  }
});
