const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');

const APP_TITLE = '工作室帳本';
const DATA_FILE_NAME = 'riso-ledger-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE_NAME);
}

async function readLedgerData() {
  const filePath = getDataFilePath();

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return {
      ok: true,
      exists: true,
      filePath,
      payload: raw.trim() ? JSON.parse(raw) : null
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ok: true, exists: false, filePath, payload: null };
    }
    if (error.name === 'SyntaxError') {
      return { ok: false, exists: true, filePath, error: 'INVALID_JSON' };
    }
    throw error;
  }
}

async function writeLedgerData(payload) {
  const filePath = getDataFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload ?? {}, null, 2), 'utf8');
  return { ok: true, filePath };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 900,
    minWidth: 980,
    minHeight: 760,
    backgroundColor: '#1c1e10',
    title: APP_TITLE,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    },
    icon: path.join(__dirname, 'icon', 'coin-logo-app-80.png')
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('ledger:load-data', async () => {
  return await readLedgerData();
});

ipcMain.handle('ledger:save-data', async (event, payload) => {
  return await writeLedgerData(payload);
});

ipcMain.handle('ledger:export-backup', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, canceled: true };

  const suggestedName = options.filename || '工作室帳本備份.json';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '匯出帳本備份',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  await fs.writeFile(filePath, JSON.stringify(options.payload ?? {}, null, 2), 'utf8');
  return { ok: true, canceled: false, filePath };
});

ipcMain.handle('ledger:import-backup', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, canceled: true };

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '匯入帳本備份',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (canceled || !filePaths?.length) {
    return { ok: false, canceled: true };
  }

  const filePath = filePaths[0];
  const raw = await fs.readFile(filePath, 'utf8');
  return { ok: true, canceled: false, filePath, payload: JSON.parse(raw) };
});

ipcMain.handle('ledger:reveal-data-file', async () => {
  const filePath = getDataFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  shell.showItemInFolder(filePath);
  return { ok: true, filePath };
});

function sendToFocused(channel) {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused) return;
  focused.webContents.send(channel);
}

function buildMenu() {
  const template = [
    {
      label: 'App',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: '匯出備份',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToFocused('ledger:menu-export-backup')
        },
        {
          label: '匯入備份',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToFocused('ledger:menu-import-backup')
        },
        {
          type: 'separator'
        },
        {
          label: '顯示資料檔位置',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToFocused('ledger:menu-reveal-data-file')
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
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
