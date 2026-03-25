const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#F7F5FB',
    title: 'Ziner Invoice',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    },
    icon: path.join(__dirname, 'assets', 'app-icon-build.png')
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('invoice:save-pdf', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return { ok: false, canceled: true };
  }

  const suggestedName = options.filename || 'ZinerStudio報價單.pdf';
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '儲存報價單 PDF',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: 'A4'
  });

  await fs.writeFile(filePath, pdfBuffer);
  return { ok: true, canceled: false, filePath };
});

ipcMain.handle('invoice:export-backup', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, canceled: true };

  const suggestedName = options.filename || 'ZinerStudio報價單備份.json';
  const payload = options.payload ?? null;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '匯出報價單備份',
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, canceled: false, filePath };
});

ipcMain.handle('invoice:import-backup', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, canceled: true };

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '匯入報價單備份',
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
          label: '出單☀︎賺錢錢',
          accelerator: 'CmdOrCtrl+P',
          click: async () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused) return;
            focused.webContents.send('invoice:menu-save-pdf');
          }
        },
        {
          label: '備份一下',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused) return;
            focused.webContents.send('invoice:menu-export-backup');
          }
        },
        {
          label: '讀取備份',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (!focused) return;
            focused.webContents.send('invoice:menu-import-backup');
          }
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
