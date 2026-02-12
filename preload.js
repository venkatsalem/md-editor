const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', { content }),

  // Session
  saveSession: (sessionData) => ipcRenderer.send('save-session', sessionData),
  saveSessionSync: (sessionData) => ipcRenderer.sendSync('save-session-sync', sessionData),

  // Theme
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),

  // Events from main process
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, data) => callback(data));
  },
  onNewFile: (callback) => {
    ipcRenderer.on('new-file', () => callback());
  },
  onSaveFile: (callback) => {
    ipcRenderer.on('save-file', () => callback());
  },
  onSaveFileAs: (callback) => {
    ipcRenderer.on('save-file-as', () => callback());
  },
  onCloseTab: (callback) => {
    ipcRenderer.on('close-tab', () => callback());
  },
  onEditorCommand: (callback) => {
    ipcRenderer.on('editor-command', (event, command) => callback(command));
  },
  onZoom: (callback) => {
    ipcRenderer.on('zoom', (event, direction) => callback(direction));
  },
  onToggleWordWrap: (callback) => {
    ipcRenderer.on('toggle-word-wrap', () => callback());
  },
  onToggleLineNumbers: (callback) => {
    ipcRenderer.on('toggle-line-numbers', () => callback());
  },
  onRequestSessionData: (callback) => {
    ipcRenderer.on('request-session-data', () => callback());
  },
  onRestoreActiveTab: (callback) => {
    ipcRenderer.on('restore-active-tab', (event, index) => callback(index));
  },
  onRestoreFontSize: (callback) => {
    ipcRenderer.on('restore-font-size', (event, size) => callback(size));
  },
  onShowNotification: (callback) => {
    ipcRenderer.on('show-notification', (event, data) => callback(data));
  }
});
