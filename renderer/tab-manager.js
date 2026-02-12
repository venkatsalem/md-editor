import { createEditor, getEditorContent, focusEditor, setFontSize } from './editor-manager.js';
import { createAutoSave } from './autosave.js';
import { showContextMenu } from './context-menu.js';

let tabs = []; // Array of tab objects
let activeTabId = null;
let tabIdCounter = 0;
let currentFontSize = 15;

const tabsContainer = document.getElementById('tabs-container');
const editorsContainer = document.getElementById('editors-container');
const welcomeScreen = document.getElementById('welcome-screen');

/**
 * Tab object shape:
 * {
 *   id: string,
 *   filePath: string | null,
 *   title: string,
 *   modified: boolean,
 *   editorView: EditorView,
 *   editorWrapper: HTMLElement,
 *   tabElement: HTMLElement,
 *   autoSave: { trigger, saveNow, cancel },
 *   content: string  // last saved content
 * }
 */

function generateTabId() {
  return 'tab-' + (++tabIdCounter);
}

function getFilename(filePath) {
  if (!filePath) return 'Untitled';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

function updateWelcomeScreen() {
  if (tabs.length === 0) {
    welcomeScreen.classList.remove('hidden');
  } else {
    welcomeScreen.classList.add('hidden');
  }
}

function setModified(tabId, modified) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.modified = modified;

  const indicator = tab.tabElement.querySelector('.tab-modified');
  if (indicator) {
    indicator.textContent = modified ? '\u25CF' : '';
  }
}

function showTabContextMenu(e, tab) {
  e.preventDefault();
  e.stopPropagation();

  const tabIndex = tabs.findIndex(t => t.id === tab.id);
  const hasOtherTabs = tabs.length > 1;
  const hasTabsToRight = tabIndex < tabs.length - 1;

  showContextMenu(e.clientX, e.clientY, [
    {
      label: 'Close',
      shortcut: 'Ctrl+W',
      action: () => closeTab(tab.id),
    },
    {
      label: 'Close Others',
      disabled: !hasOtherTabs,
      action: () => closeOtherTabs(tab.id),
    },
    {
      label: 'Close to the Right',
      disabled: !hasTabsToRight,
      action: () => closeTabsToRight(tab.id),
    },
    {
      label: 'Close All',
      action: () => closeAllTabs(),
    },
    { separator: true },
    {
      label: 'Copy Path',
      disabled: !tab.filePath,
      action: () => {
        if (tab.filePath) {
          navigator.clipboard.writeText(tab.filePath);
        }
      },
    },
  ]);
}

let draggedTabId = null;

function createTabElement(tab) {
  const el = document.createElement('div');
  el.className = 'tab';
  el.dataset.tabId = tab.id;
  el.title = tab.filePath || 'Untitled';
  el.draggable = true;

  const titleSpan = document.createElement('span');
  titleSpan.className = 'tab-title';
  titleSpan.textContent = tab.title;

  const modifiedSpan = document.createElement('span');
  modifiedSpan.className = 'tab-modified';
  modifiedSpan.textContent = '';

  el.appendChild(titleSpan);
  el.appendChild(modifiedSpan);

  // Click to activate
  el.addEventListener('click', () => {
    activateTab(tab.id);
  });

  // Middle-click to close
  el.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(tab.id);
    }
  });

  // Right-click context menu
  el.addEventListener('contextmenu', (e) => {
    showTabContextMenu(e, tab);
  });

  // --- Drag-and-drop reorder ---
  el.addEventListener('dragstart', (e) => {
    draggedTabId = tab.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Set minimal drag data so the browser allows the drag
    e.dataTransfer.setData('text/plain', tab.id);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    draggedTabId = null;
    // Remove all drop indicators
    tabsContainer.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('drop-left', 'drop-right');
    });
  });

  el.addEventListener('dragover', (e) => {
    if (!draggedTabId || draggedTabId === tab.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Show drop indicator on left or right half
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    el.classList.remove('drop-left', 'drop-right');
    if (e.clientX < midX) {
      el.classList.add('drop-left');
    } else {
      el.classList.add('drop-right');
    }
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drop-left', 'drop-right');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-left', 'drop-right');
    if (!draggedTabId || draggedTabId === tab.id) return;

    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midX;

    reorderTab(draggedTabId, tab.id, insertBefore);
    draggedTabId = null;
  });

  return el;
}

/**
 * Reorder a tab in both the tabs array and the DOM.
 * @param {string} movedTabId - The tab being dragged
 * @param {string} targetTabId - The tab being dropped onto
 * @param {boolean} before - Insert before (true) or after (false) the target
 */
function reorderTab(movedTabId, targetTabId, before) {
  const movedIndex = tabs.findIndex(t => t.id === movedTabId);
  const targetIndex = tabs.findIndex(t => t.id === targetTabId);
  if (movedIndex === -1 || targetIndex === -1) return;

  const movedTab = tabs[movedIndex];

  // Remove from array
  tabs.splice(movedIndex, 1);

  // Find new target index after removal
  let newIndex = tabs.findIndex(t => t.id === targetTabId);
  if (!before) newIndex += 1;

  // Insert at new position
  tabs.splice(newIndex, 0, movedTab);

  // Reorder DOM to match
  const targetEl = tabs[newIndex === tabs.length - 1 ? newIndex : newIndex + 1]
    ? tabs[newIndex + 1]?.tabElement
    : null;

  if (targetEl) {
    tabsContainer.insertBefore(movedTab.tabElement, targetEl);
  } else {
    tabsContainer.appendChild(movedTab.tabElement);
  }
}

function createEditorWrapper(tab, content) {
  const wrapper = document.createElement('div');
  wrapper.className = 'editor-wrapper';
  wrapper.dataset.tabId = tab.id;
  editorsContainer.appendChild(wrapper);

  const editorView = createEditor(wrapper, content, (newContent) => {
    // On content change
    const savedContent = tab.content;
    const isModified = newContent !== savedContent;
    setModified(tab.id, isModified);

    if (isModified) {
      tab.autoSave.trigger();
    }
  });

  // Apply current font size
  if (currentFontSize !== 15) {
    setFontSize(editorView, currentFontSize);
  }

  return { wrapper, editorView };
}

/**
 * Create a new tab.
 * @param {string|null} filePath - File path or null for untitled
 * @param {string} content - Initial content
 * @returns {object} The tab object
 */
export function createTab(filePath, content = '') {
  // Check if file is already open
  if (filePath) {
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) {
      activateTab(existing.id);
      return existing;
    }
  }

  const id = generateTabId();
  const title = getFilename(filePath);

  const tab = {
    id,
    filePath,
    title,
    modified: false,
    editorView: null,
    editorWrapper: null,
    tabElement: null,
    autoSave: null,
    content: content, // saved content baseline
  };

  // Create auto-save
  tab.autoSave = createAutoSave(
    () => ({
      filePath: tab.filePath,
      content: getEditorContent(tab.editorView),
    }),
    () => {
      // On save success
      tab.content = getEditorContent(tab.editorView);
      setModified(tab.id, false);
    },
    (error) => {
      // On save error
      showNotification('error', `Failed to save ${tab.title}: ${error}`);
    }
  );

  // Create tab element
  tab.tabElement = createTabElement(tab);
  tabsContainer.appendChild(tab.tabElement);

  // Create editor
  const { wrapper, editorView } = createEditorWrapper(tab, content);
  tab.editorWrapper = wrapper;
  tab.editorView = editorView;

  tabs.push(tab);
  activateTab(id);
  updateWelcomeScreen();

  return tab;
}

/**
 * Activate a tab by ID.
 * @param {string} tabId
 */
export function activateTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  // Deactivate all
  tabs.forEach(t => {
    t.tabElement.classList.remove('active');
    t.editorWrapper.classList.remove('active');
  });

  // Activate target
  tab.tabElement.classList.add('active');
  tab.editorWrapper.classList.add('active');
  activeTabId = tabId;

  // Focus editor after a brief delay to ensure DOM is ready
  setTimeout(() => focusEditor(tab.editorView), 10);

  // Scroll tab into view
  tab.tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

/**
 * Close a tab by ID.
 * @param {string} tabId
 */
export function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const tab = tabs[index];

  // Cancel auto-save
  tab.autoSave.cancel();

  // If modified and has file path, save now before closing
  if (tab.modified && tab.filePath) {
    tab.autoSave.saveNow();
  }

  // Destroy editor
  tab.editorView.destroy();
  tab.editorWrapper.remove();
  tab.tabElement.remove();

  tabs.splice(index, 1);

  // If we closed the active tab, activate another
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newIndex = Math.min(index, tabs.length - 1);
      activateTab(tabs[newIndex].id);
    } else {
      activeTabId = null;
    }
  }

  updateWelcomeScreen();
}

/**
 * Close all tabs except the one with the given ID.
 * @param {string} keepTabId
 */
export function closeOtherTabs(keepTabId) {
  const toClose = tabs.filter(t => t.id !== keepTabId).map(t => t.id);
  toClose.forEach(id => closeTab(id));
}

/**
 * Close all tabs to the right of the given tab.
 * @param {string} tabId
 */
export function closeTabsToRight(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  const toClose = tabs.slice(index + 1).map(t => t.id);
  toClose.forEach(id => closeTab(id));
}

/**
 * Close all tabs.
 */
export function closeAllTabs() {
  const toClose = tabs.map(t => t.id);
  toClose.forEach(id => closeTab(id));
}

/**
 * Close the currently active tab.
 */
export function closeActiveTab() {
  if (activeTabId) {
    closeTab(activeTabId);
  }
}

/**
 * Get the active tab object.
 * @returns {object|null}
 */
export function getActiveTab() {
  if (!activeTabId) return null;
  return tabs.find(t => t.id === activeTabId) || null;
}

/**
 * Get all tabs.
 * @returns {object[]}
 */
export function getAllTabs() {
  return tabs;
}

/**
 * Get all editor views.
 * @returns {EditorView[]}
 */
export function getAllEditorViews() {
  return tabs.map(t => t.editorView);
}

/**
 * Switch to the next tab.
 */
export function nextTab() {
  if (tabs.length <= 1) return;
  const index = tabs.findIndex(t => t.id === activeTabId);
  const nextIndex = (index + 1) % tabs.length;
  activateTab(tabs[nextIndex].id);
}

/**
 * Switch to the previous tab.
 */
export function prevTab() {
  if (tabs.length <= 1) return;
  const index = tabs.findIndex(t => t.id === activeTabId);
  const prevIndex = (index - 1 + tabs.length) % tabs.length;
  activateTab(tabs[prevIndex].id);
}

/**
 * Save the active tab.
 * If it has no file path, trigger "Save As".
 */
export async function saveActiveTab() {
  const tab = getActiveTab();
  if (!tab) return;

  if (!tab.filePath) {
    // Save As
    await saveActiveTabAs();
    return;
  }

  const content = getEditorContent(tab.editorView);
  const result = await window.electronAPI.saveFile(tab.filePath, content);
  if (result.success) {
    tab.content = content;
    setModified(tab.id, false);
  } else {
    showNotification('error', `Failed to save: ${result.error}`);
  }
}

/**
 * Save the active tab with "Save As" dialog.
 */
export async function saveActiveTabAs() {
  const tab = getActiveTab();
  if (!tab) return;

  const content = getEditorContent(tab.editorView);
  const result = await window.electronAPI.saveFileAs(content);

  if (result && result.success && result.filePath) {
    tab.filePath = result.filePath;
    tab.title = getFilename(result.filePath);
    tab.content = content;
    setModified(tab.id, false);

    // Update tab element
    const titleSpan = tab.tabElement.querySelector('.tab-title');
    titleSpan.textContent = tab.title;
    tab.tabElement.title = tab.filePath;
  } else if (result && !result.canceled && !result.success) {
    showNotification('error', `Failed to save: ${result.error}`);
  }
}

/**
 * Save all modified tabs that have file paths.
 */
export async function saveAllModifiedTabs() {
  const modifiedTabs = tabs.filter(t => t.modified && t.filePath);
  for (const tab of modifiedTabs) {
    await tab.autoSave.saveNow();
  }
}

/**
 * Get session data for persistence.
 * @returns {{ files: string[], activeIndex: number, fontSize: number }}
 */
export function getSessionData() {
  const files = tabs.filter(t => t.filePath).map(t => t.filePath);
  const activeIndex = tabs.findIndex(t => t.id === activeTabId);
  return { files, activeIndex: Math.max(0, activeIndex), fontSize: currentFontSize };
}

/**
 * Update the font size for all editors.
 * @param {number} size
 */
export function updateFontSize(size) {
  currentFontSize = size;
  document.documentElement.style.setProperty('--font-size', size + 'px');
  tabs.forEach(tab => {
    setFontSize(tab.editorView, size);
  });
}

/**
 * Get current font size.
 * @returns {number}
 */
export function getFontSize() {
  return currentFontSize;
}

/**
 * Activate tab by index (for session restore).
 * @param {number} index
 */
export function activateTabByIndex(index) {
  if (index >= 0 && index < tabs.length) {
    activateTab(tabs[index].id);
  }
}

// Notification helper
function showNotification(type, message) {
  const bar = document.getElementById('notification-bar');
  const msgEl = document.getElementById('notification-message');
  bar.className = type === 'error' ? 'error' : '';
  msgEl.textContent = message;
  bar.classList.remove('hidden');

  // Auto-hide after 5 seconds for non-errors
  if (type !== 'error') {
    setTimeout(() => {
      bar.classList.add('hidden');
    }, 5000);
  }
}
