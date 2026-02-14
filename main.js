const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const { readFile, writeFile, fileExists } = require('./utils/file-ops');
const { saveSession, loadSession } = require('./utils/session-store');
const { getRecentFiles, addRecentFile, clearRecentFiles } = require('./utils/recent-files');

let mainWindow = null;

function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function getBgColorForTheme() {
  return getSystemTheme() === 'dark' ? '#1a1a1a' : '#e0e0e0';
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // When a second instance is launched, focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Open any files passed as arguments
      const filePaths = commandLine.slice(1).filter(arg => {
        return arg.endsWith('.md') && !arg.startsWith('--');
      });
      filePaths.forEach(fp => {
        const resolved = path.resolve(fp);
        readFile(resolved).then(result => {
          if (result.success) {
            mainWindow.webContents.send('file-opened', {
              filePath: resolved,
              content: result.content
            });
            addRecentFile(resolved);
            buildMenu();
          }
        });
      });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    backgroundColor: getBgColorForTheme(),
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      zoomFactor: 1.1
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Session save on close — use synchronous IPC to avoid race condition
  mainWindow.on('close', (e) => {
    // Send session save request and give renderer time to process
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('request-session-data');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Restore session after window is ready
  mainWindow.webContents.on('did-finish-load', async () => {
    // Send the current system theme to the renderer
    mainWindow.webContents.send('theme-changed', getSystemTheme());

    // Open files from command line arguments
    const args = process.argv.slice(1).filter(arg => {
      return arg.endsWith('.md') && !arg.startsWith('--');
    });

    if (args.length > 0) {
      for (const fp of args) {
        const resolved = path.resolve(fp);
        const result = await readFile(resolved);
        if (result.success) {
          mainWindow.webContents.send('file-opened', {
            filePath: resolved,
            content: result.content
          });
          addRecentFile(resolved);
        }
      }
      buildMenu();
    } else {
      // Restore previous session
      const session = loadSession();
      if (session && session.files && session.files.length > 0) {
        for (const fp of session.files) {
          const exists = await fileExists(fp);
          if (exists) {
            const result = await readFile(fp);
            if (result.success) {
              mainWindow.webContents.send('file-opened', {
                filePath: fp,
                content: result.content
              });
            }
          }
        }
        // Restore active tab
        if (typeof session.activeIndex === 'number') {
          mainWindow.webContents.send('restore-active-tab', session.activeIndex);
        }
        // Restore zoom level
        if (typeof session.fontSize === 'number') {
          mainWindow.webContents.send('restore-font-size', session.fontSize);
        }
        // Restore read-only tabs
        if (Array.isArray(session.readOnlyFiles) && session.readOnlyFiles.length > 0) {
          mainWindow.webContents.send('restore-read-only', session.readOnlyFiles);
        }
      }
    }
  });

  // Listen for OS theme changes and forward to renderer
  nativeTheme.on('updated', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('theme-changed', getSystemTheme());
    }
  });

  buildMenu();
}

function buildMenu() {
  const recentFiles = getRecentFiles();
  const recentSubmenu = recentFiles.length > 0
    ? [
        ...recentFiles.map(fp => ({
          label: fp,
          click: () => openFilePath(fp)
        })),
        { type: 'separator' },
        {
          label: 'Clear Recent',
          click: () => {
            clearRecentFiles();
            buildMenu();
          }
        }
      ]
    : [{ label: 'No Recent Files', enabled: false }];

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow && mainWindow.webContents.send('new-file')
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow && mainWindow.webContents.send('save-file')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow && mainWindow.webContents.send('save-file-as')
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow && mainWindow.webContents.send('close-tab')
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow && mainWindow.webContents.send('editor-command', 'undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow && mainWindow.webContents.send('editor-command', 'redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow && mainWindow.webContents.send('editor-command', 'find')
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow && mainWindow.webContents.send('editor-command', 'replace')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow && mainWindow.webContents.send('zoom', 'in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow && mainWindow.webContents.send('zoom', 'out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow && mainWindow.webContents.send('zoom', 'reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Word Wrap',
          click: () => mainWindow && mainWindow.webContents.send('toggle-word-wrap')
        },
        {
          label: 'Toggle Line Numbers',
          click: () => mainWindow && mainWindow.webContents.send('toggle-line-numbers')
        },
        { type: 'separator' },
        {
          label: 'Toggle Read-Only',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow && mainWindow.webContents.send('toggle-read-only')
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleOpenFile() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) return;

  for (const fp of result.filePaths) {
    await openFilePath(fp);
  }
}

async function openFilePath(filePath) {
  const result = await readFile(filePath);
  if (result.success && mainWindow) {
    mainWindow.webContents.send('file-opened', {
      filePath: filePath,
      content: result.content
    });
    addRecentFile(filePath);
    buildMenu();
  } else if (!result.success && mainWindow) {
    mainWindow.webContents.send('show-notification', {
      type: 'error',
      message: `Failed to open file: ${result.error}`
    });
  }
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  await handleOpenFile();
});

ipcMain.handle('read-file', async (event, filePath) => {
  return await readFile(filePath);
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  const result = await writeFile(filePath, content);
  if (result.success) {
    addRecentFile(filePath);
    buildMenu();
  }
  return result;
});

ipcMain.handle('save-file-as', async (event, { content }) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Markdown File',
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'untitled.md'
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  const writeResult = await writeFile(result.filePath, content);
  if (writeResult.success) {
    addRecentFile(result.filePath);
    buildMenu();
  }
  return { ...writeResult, filePath: result.filePath };
});

// Session save — synchronous handler so the renderer can save before close
ipcMain.on('save-session', (event, sessionData) => {
  saveSession(sessionData);
});

// Synchronous session save for the close event
ipcMain.on('save-session-sync', (event, sessionData) => {
  saveSession(sessionData);
  event.returnValue = true;
});

ipcMain.handle('get-system-theme', () => {
  return getSystemTheme();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file open on macOS (double-click .md file)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    await openFilePath(filePath);
  }
});
