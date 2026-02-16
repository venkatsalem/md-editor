/**
 * Todo board renderer for .json todo files.
 * Renders a card-based todo list UI inside a wrapper element.
 * All mutations call onChange() so the tab-manager can trigger autosave.
 *
 * Schema:
 * {
 *   "lists": [
 *     {
 *       "id": "string",
 *       "title": "string",
 *       "tasks": [
 *         { "id": "string", "text": "string", "done": false }
 *       ]
 *     }
 *   ]
 * }
 */

import { showContextMenu } from './context-menu.js';

let idCounter = Date.now();
function uid() {
  return 'td-' + (idCounter++).toString(36);
}

/**
 * Check if a JSON string represents a valid todo file.
 * @param {string} content - Raw JSON string
 * @returns {boolean}
 */
export function isTodoJson(content) {
  try {
    const data = JSON.parse(content);
    return data && Array.isArray(data.lists);
  } catch {
    return false;
  }
}

/**
 * Parse a todo JSON string into a data structure.
 * Returns a default structure if parsing fails.
 * @param {string} content
 * @returns {{ lists: Array }}
 */
export function parseTodoData(content) {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.lists)) {
      for (const list of data.lists) {
        if (!list.id) list.id = uid();
        if (!Array.isArray(list.tasks)) list.tasks = [];
        for (const task of list.tasks) {
          if (!task.id) task.id = uid();
        }
      }
      return data;
    }
  } catch { /* ignore */ }
  return { lists: [] };
}

/**
 * Serialize todo data back to a formatted JSON string.
 * @param {{ lists: Array }} data
 * @returns {string}
 */
export function serializeTodoData(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

// ===== Drag state =====
let draggedTaskEl = null;
let draggedTaskData = null;
let draggedTaskSourceList = null;

let draggedTileEl = null;
let draggedTileData = null;

/**
 * Render the full todo board into a wrapper element.
 * @param {HTMLElement} wrapper - The container element
 * @param {{ lists: Array }} data - The todo data
 * @param {Function} onChange - Called whenever data changes
 */
export function renderTodoBoard(wrapper, data, onChange) {
  wrapper.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'todo-board';

  const grid = document.createElement('div');
  grid.className = 'todo-grid';

  for (const list of data.lists) {
    const tile = createListTile(list, data, onChange, wrapper, grid);
    grid.appendChild(tile);
  }

  board.appendChild(grid);
  wrapper.appendChild(board);

  // Right-click on board background to add a new list
  board.addEventListener('contextmenu', (e) => {
    // Only trigger if clicking on the board/grid itself, not on a tile
    if (e.target === board || e.target === grid) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        {
          label: 'New List',
          action: () => {
            const newList = { id: uid(), title: 'New List', tasks: [] };
            data.lists.push(newList);
            onChange();
            renderTodoBoard(wrapper, data, onChange);
            // Focus title for editing
            const tiles = wrapper.querySelectorAll('.todo-tile');
            const lastTile = tiles[tiles.length - 1];
            if (lastTile) {
              const titleEl = lastTile.querySelector('.todo-tile-title');
              if (titleEl) startEditTitleInline(titleEl, newList, data, onChange);
            }
          },
        },
      ]);
    }
  });
}

function createListTile(list, data, onChange, wrapper, grid) {
  const tile = document.createElement('div');
  tile.className = 'todo-tile';
  tile.dataset.listId = list.id;

  // --- Tile drag-and-drop (reorder lists) ---
  tile.draggable = true;

  tile.addEventListener('dragstart', (e) => {
    // Don't drag if we're editing or dragging a task
    if (e.target !== tile && !tile.querySelector('.todo-tile-header')?.contains(e.target)) return;
    if (draggedTaskEl) return; // task drag takes priority
    draggedTileEl = tile;
    draggedTileData = list;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', list.id);
  });

  tile.addEventListener('dragend', () => {
    tile.classList.remove('dragging');
    draggedTileEl = null;
    draggedTileData = null;
    grid.querySelectorAll('.todo-tile').forEach(t => {
      t.classList.remove('drop-left', 'drop-right');
    });
  });

  tile.addEventListener('dragover', (e) => {
    if (draggedTileEl && draggedTileEl !== tile) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = tile.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      tile.classList.remove('drop-left', 'drop-right');
      tile.classList.add(e.clientX < midX ? 'drop-left' : 'drop-right');
    }
  });

  tile.addEventListener('dragleave', () => {
    tile.classList.remove('drop-left', 'drop-right');
  });

  tile.addEventListener('drop', (e) => {
    tile.classList.remove('drop-left', 'drop-right');
    if (draggedTileEl && draggedTileEl !== tile && draggedTileData) {
      e.preventDefault();
      e.stopPropagation();
      const rect = tile.getBoundingClientRect();
      const insertBefore = e.clientX < rect.left + rect.width / 2;

      const fromIdx = data.lists.findIndex(l => l.id === draggedTileData.id);
      if (fromIdx === -1) return;
      data.lists.splice(fromIdx, 1);

      let toIdx = data.lists.findIndex(l => l.id === list.id);
      if (!insertBefore) toIdx += 1;
      data.lists.splice(toIdx, 0, draggedTileData);

      onChange();
      renderTodoBoard(wrapper, data, onChange);
    }
  });

  // Header
  const header = document.createElement('div');
  header.className = 'todo-tile-header';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'todo-tile-title';
  titleSpan.textContent = list.title || 'Untitled';
  titleSpan.addEventListener('dblclick', () => {
    startEditTitleInline(titleSpan, list, data, onChange);
  });

  header.appendChild(titleSpan);
  tile.appendChild(header);

  // Right-click context menu on tile header
  header.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Rename List',
        action: () => startEditTitleInline(titleSpan, list, data, onChange),
      },
      { separator: true },
      {
        label: 'Delete List',
        action: () => confirmDeleteList(tile, list, data, onChange, wrapper),
      },
    ]);
  });

  // Task list body
  const taskBody = document.createElement('div');
  taskBody.className = 'todo-tile-body';

  // --- Task drop zone (for reordering within and between lists) ---
  taskBody.addEventListener('dragover', (e) => {
    if (!draggedTaskEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Find the task element we're hovering over
    const target = getTaskElementAt(taskBody, e.clientY);
    clearTaskDropIndicators(taskBody);
    if (target && target !== draggedTaskEl) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      target.classList.add(e.clientY < midY ? 'drop-above' : 'drop-below');
    }
  });

  taskBody.addEventListener('dragleave', () => {
    clearTaskDropIndicators(taskBody);
  });

  taskBody.addEventListener('drop', (e) => {
    if (!draggedTaskEl || !draggedTaskData || !draggedTaskSourceList) return;
    e.preventDefault();
    e.stopPropagation();
    clearTaskDropIndicators(taskBody);

    // Remove from source list
    const srcIdx = draggedTaskSourceList.tasks.findIndex(t => t.id === draggedTaskData.id);
    if (srcIdx !== -1) draggedTaskSourceList.tasks.splice(srcIdx, 1);

    // Find insert position
    const target = getTaskElementAt(taskBody, e.clientY);
    if (target && target !== draggedTaskEl) {
      const rect = target.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;
      const targetId = target.dataset.taskId;
      let destIdx = list.tasks.findIndex(t => t.id === targetId);
      if (!insertBefore) destIdx += 1;
      list.tasks.splice(destIdx, 0, draggedTaskData);
    } else {
      // Drop at end
      list.tasks.push(draggedTaskData);
    }

    onChange();
    renderTodoBoard(wrapper, data, onChange);
  });

  for (const task of list.tasks) {
    const taskEl = createTaskElement(task, list, data, onChange, taskBody, wrapper);
    taskBody.appendChild(taskEl);
  }

  // Inline add row
  const addRow = document.createElement('div');
  addRow.className = 'todo-task todo-task-add';

  const addCheckbox = document.createElement('input');
  addCheckbox.type = 'checkbox';
  addCheckbox.className = 'todo-task-checkbox';
  addCheckbox.disabled = true;

  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.className = 'todo-task-add-input';
  addInput.placeholder = 'New task...';
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && addInput.value.trim()) {
      const newTask = { id: uid(), text: addInput.value.trim(), done: false };
      list.tasks.push(newTask);
      onChange();

      const taskEl = createTaskElement(newTask, list, data, onChange, taskBody, wrapper);
      taskBody.insertBefore(taskEl, addRow);
      addInput.value = '';
      taskBody.scrollTop = taskBody.scrollHeight;
    }
  });

  addRow.appendChild(addCheckbox);
  addRow.appendChild(addInput);
  taskBody.appendChild(addRow);

  tile.appendChild(taskBody);
  return tile;
}

function createTaskElement(task, list, data, onChange, taskBody, wrapper) {
  const taskEl = document.createElement('div');
  taskEl.className = 'todo-task';
  if (task.done) taskEl.classList.add('done');
  taskEl.dataset.taskId = task.id;
  taskEl.draggable = true;

  // --- Task drag ---
  taskEl.addEventListener('dragstart', (e) => {
    e.stopPropagation(); // prevent tile drag
    draggedTaskEl = taskEl;
    draggedTaskData = task;
    draggedTaskSourceList = list;
    taskEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  });

  taskEl.addEventListener('dragend', () => {
    taskEl.classList.remove('dragging');
    draggedTaskEl = null;
    draggedTaskData = null;
    draggedTaskSourceList = null;
    // Clean up all indicators
    document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
      el.classList.remove('drop-above', 'drop-below');
    });
  });

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.className = 'todo-task-checkbox';

  // Delete button (shown only when done)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'todo-task-delete';
  deleteBtn.innerHTML = '&#10005;';
  deleteBtn.title = 'Delete task';
  deleteBtn.addEventListener('click', () => {
    const idx = list.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      list.tasks.splice(idx, 1);
      onChange();
      taskEl.style.opacity = '0';
      taskEl.style.transform = 'translateX(20px)';
      setTimeout(() => taskEl.remove(), 200);
    }
  });

  checkbox.addEventListener('change', () => {
    task.done = checkbox.checked;
    taskEl.classList.toggle('done', task.done);
    textSpan.classList.toggle('done', task.done);
    onChange();
  });

  // Text
  const textSpan = document.createElement('span');
  textSpan.className = 'todo-task-text';
  if (task.done) textSpan.classList.add('done');
  textSpan.textContent = task.text;
  textSpan.addEventListener('dblclick', () => {
    startEditTask(textSpan, task, onChange);
  });

  // Right-click context menu on task
  taskEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Edit Task',
        action: () => startEditTask(textSpan, task, onChange),
      },
      { separator: true },
      {
        label: 'Delete Task',
        action: () => {
          if (!confirm('Delete this task?')) return;
          const idx = list.tasks.findIndex(t => t.id === task.id);
          if (idx !== -1) {
            list.tasks.splice(idx, 1);
            onChange();
            taskEl.style.opacity = '0';
            taskEl.style.transform = 'translateX(20px)';
            setTimeout(() => taskEl.remove(), 200);
          }
        },
      },
    ]);
  });

  taskEl.appendChild(checkbox);
  taskEl.appendChild(textSpan);
  taskEl.appendChild(deleteBtn);

  return taskEl;
}

// ===== Helpers =====

function getTaskElementAt(taskBody, clientY) {
  const tasks = Array.from(taskBody.querySelectorAll('.todo-task:not(.todo-task-add):not(.dragging)'));
  for (const task of tasks) {
    const rect = task.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return task;
    }
  }
  return null;
}

function clearTaskDropIndicators(taskBody) {
  taskBody.querySelectorAll('.drop-above, .drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });
}

function confirmDeleteList(tile, list, data, onChange, wrapper) {
  if (!confirm(`Delete list "${list.title}"?`)) return;
  const idx = data.lists.findIndex(l => l.id === list.id);
  if (idx !== -1) {
    data.lists.splice(idx, 1);
    onChange();
    tile.style.opacity = '0';
    tile.style.transform = 'scale(0.95)';
    setTimeout(() => {
      renderTodoBoard(wrapper, data, onChange);
    }, 200);
  }
}

// ===== Inline editing =====

function makeEditable(el, getText, setText, onChange) {
  if (el.contentEditable === 'true') return;
  const original = getText();
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();

  // Place cursor at end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function commit() {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.removeEventListener('keydown', onKey);
    const newText = el.textContent.trim();
    if (newText && newText !== original) {
      setText(newText);
      onChange();
    }
    el.textContent = getText();
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    }
    if (e.key === 'Escape') {
      el.textContent = original;
      el.blur();
    }
  }

  el.addEventListener('blur', commit, { once: true });
  el.addEventListener('keydown', onKey);
}

function startEditTask(textSpan, task, onChange) {
  makeEditable(
    textSpan,
    () => task.text,
    (v) => { task.text = v; },
    onChange
  );
}

function startEditTitleInline(titleSpan, list, data, onChange) {
  makeEditable(
    titleSpan,
    () => list.title,
    (v) => { list.title = v; },
    onChange
  );
}
