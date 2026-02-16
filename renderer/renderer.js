import {
  createTab,
  createTodoTab,
  closeActiveTab,
  getActiveTab,
  getAllTabs,
  getAllEditorViews,
  nextTab,
  prevTab,
  saveActiveTab,
  saveActiveTabAs,
  saveAllModifiedTabs,
  getSessionData,
  updateFontSize,
  getFontSize,
  activateTabByIndex,
  toggleActiveReadOnly,
  setReadOnlyByPath,
} from './tab-manager.js';

import { isTodoJson } from './todo-renderer.js';

import {
  editorUndo,
  editorRedo,
  editorFind,
  editorReplace,
  toggleWordWrap,
  toggleLineNumbers,
  applyTheme,
  setInitialTheme,
} from './editor-manager.js';

import { showContextMenu } from './context-menu.js';

const { electronAPI } = window;

// ===== Theme Handling =====
function applyThemeToUI(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update CodeMirror editors
  const views = getAllEditorViews();
  applyTheme(views, theme);
}

// Listen for system theme changes from main process
electronAPI.onThemeChanged((theme) => {
  applyThemeToUI(theme);
});

// Also detect via CSS media query for immediate startup matching
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
const initialTheme = darkMq.matches ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', initialTheme);
setInitialTheme(initialTheme);

// ===== Window Controls =====
document.getElementById('btn-minimize').addEventListener('click', () => {
  electronAPI.minimizeWindow();
});

document.getElementById('btn-maximize').addEventListener('click', () => {
  electronAPI.maximizeWindow();
});

document.getElementById('btn-close').addEventListener('click', () => {
  electronAPI.closeWindow();
});

// ===== IPC Event Handlers =====

// File opened from main process (via menu, session restore, drag-drop, etc.)
electronAPI.onFileOpened((data) => {
  if (data && data.filePath && data.content !== null && data.content !== undefined) {
    // Detect todo.json files and open in board view
    if (data.filePath.endsWith('.json') && isTodoJson(data.content)) {
      createTodoTab(data.filePath, data.content);
    } else {
      createTab(data.filePath, data.content);
    }
  }
});

// New file
electronAPI.onNewFile(() => {
  createTab(null, '');
});

// Save file
electronAPI.onSaveFile(() => {
  saveActiveTab();
});

// Save file as
electronAPI.onSaveFileAs(() => {
  saveActiveTabAs();
});

// Close tab
electronAPI.onCloseTab(() => {
  closeActiveTab();
});

// Editor commands (undo, redo, find, replace)
electronAPI.onEditorCommand((command) => {
  const tab = getActiveTab();
  if (!tab || tab.isTodo) return; // Skip for todo tabs

  switch (command) {
    case 'undo':
      editorUndo(tab.editorView);
      break;
    case 'redo':
      editorRedo(tab.editorView);
      break;
    case 'find':
      editorFind(tab.editorView);
      break;
    case 'replace':
      editorReplace(tab.editorView);
      break;
  }
});

// Zoom
electronAPI.onZoom((direction) => {
  let size = getFontSize();
  switch (direction) {
    case 'in':
      size = Math.min(size + 1, 32);
      break;
    case 'out':
      size = Math.max(size - 1, 8);
      break;
    case 'reset':
      size = 15;
      break;
  }
  updateFontSize(size);
});

// Toggle word wrap
electronAPI.onToggleWordWrap(() => {
  const views = getAllEditorViews();
  toggleWordWrap(views);
});

// Toggle line numbers
electronAPI.onToggleLineNumbers(() => {
  const views = getAllEditorViews();
  toggleLineNumbers(views);
});

// Toggle read-only (from menu)
electronAPI.onToggleReadOnly(() => {
  toggleActiveReadOnly();
});

// Session data request (before close) — use synchronous IPC to ensure data is saved
electronAPI.onRequestSessionData(() => {
  const sessionData = getSessionData();
  // Use synchronous save to guarantee write before window closes
  electronAPI.saveSessionSync(sessionData);
});

// Restore active tab
electronAPI.onRestoreActiveTab((index) => {
  activateTabByIndex(index);
});

// Restore font size / zoom level
electronAPI.onRestoreFontSize((size) => {
  if (typeof size === 'number' && size >= 8 && size <= 32) {
    updateFontSize(size);
  }
});

// Restore read-only state for tabs
electronAPI.onRestoreReadOnly((filePaths) => {
  if (Array.isArray(filePaths)) {
    filePaths.forEach(fp => setReadOnlyByPath(fp));
  }
});

// Show notification
electronAPI.onShowNotification((data) => {
  const bar = document.getElementById('notification-bar');
  const msgEl = document.getElementById('notification-message');
  bar.className = data.type === 'error' ? 'error' : '';
  msgEl.textContent = data.message;
  bar.classList.remove('hidden');

  if (data.type !== 'error') {
    setTimeout(() => bar.classList.add('hidden'), 5000);
  }
});

// ===== Editor Context Menu =====
document.getElementById('editor-area').addEventListener('contextmenu', (e) => {
  const tab = getActiveTab();
  if (!tab) return;

  e.preventDefault();

  // Todo tabs handle their own interactions — no editor context menu
  if (tab.isTodo) return;

  // In read-only mode, show a minimal context menu
  if (tab.readOnly) {
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Edit Mode',
        shortcut: 'Ctrl+Shift+R',
        action: () => toggleActiveReadOnly(),
      },
      { separator: true },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: () => {
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            navigator.clipboard.writeText(selection.toString());
          }
        },
      },
      {
        label: 'Select All',
        shortcut: 'Ctrl+A',
        action: () => {
          const preview = tab.previewWrapper?.querySelector('.markdown-preview');
          if (preview) {
            const range = document.createRange();
            range.selectNodeContents(preview);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        },
      },
    ]);
    return;
  }

  // Normal edit mode context menu
  const view = tab.editorView;
  const hasSelection = view.state.selection.main.from !== view.state.selection.main.to;

  showContextMenu(e.clientX, e.clientY, [
    {
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      action: () => editorUndo(view),
    },
    {
      label: 'Redo',
      shortcut: 'Ctrl+Shift+Z',
      action: () => editorRedo(view),
    },
    { separator: true },
    {
      label: 'Cut',
      shortcut: 'Ctrl+X',
      disabled: !hasSelection,
      action: () => {
        document.execCommand('cut');
      },
    },
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      disabled: !hasSelection,
      action: () => {
        document.execCommand('copy');
      },
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      action: () => {
        navigator.clipboard.readText().then(text => {
          view.dispatch(view.state.replaceSelection(text));
          view.focus();
        });
      },
    },
    { separator: true },
    {
      label: 'Select All',
      shortcut: 'Ctrl+A',
      action: () => {
        view.dispatch({
          selection: { anchor: 0, head: view.state.doc.length },
        });
        view.focus();
      },
    },
    { separator: true },
    {
      label: 'Find',
      shortcut: 'Ctrl+F',
      action: () => editorFind(view),
    },
    {
      label: 'Replace',
      shortcut: 'Ctrl+H',
      action: () => editorReplace(view),
    },
  ]);
});

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  // Ctrl+Tab / Ctrl+Shift+Tab for tab cycling
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      prevTab();
    } else {
      nextTab();
    }
    return;
  }

  // Ctrl+N for new file (backup in case menu doesn't catch it)
  if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
    e.preventDefault();
    createTab(null, '');
    return;
  }

  // Ctrl+W for close tab
  if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
    e.preventDefault();
    closeActiveTab();
    return;
  }

  // Ctrl+Shift+R for toggle read-only
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    toggleActiveReadOnly();
    return;
  }
});

// ===== Drag and Drop =====
const dropOverlay = document.getElementById('drop-overlay');
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) {
    dropOverlay.classList.remove('hidden');
  }
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dropOverlay.classList.add('hidden');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.add('hidden');

  const files = Array.from(e.dataTransfer.files);
  for (const file of files) {
    const name = file.name.toLowerCase();
    const isMarkdown = name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.mdown');
    const isJson = name.endsWith('.json');

    if (isMarkdown || isJson) {
      const filePath = file.path;
      if (filePath) {
        const result = await electronAPI.readFile(filePath);
        if (result.success) {
          if (isJson && isTodoJson(result.content)) {
            createTodoTab(filePath, result.content);
          } else {
            createTab(filePath, result.content);
          }
        }
      }
    }
  }
});

// ===== Focus Loss: Save All =====
window.addEventListener('blur', () => {
  saveAllModifiedTabs();
});

// ===== Beforeunload: Last-resort session save =====
window.addEventListener('beforeunload', () => {
  const sessionData = getSessionData();
  electronAPI.saveSessionSync(sessionData);
});

// ===== Notification Bar Close =====
document.getElementById('notification-close').addEventListener('click', () => {
  document.getElementById('notification-bar').classList.add('hidden');
});
