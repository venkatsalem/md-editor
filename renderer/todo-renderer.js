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
      // Ensure every list/task has an id
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
    const tile = createListTile(list, data, onChange);
    grid.appendChild(tile);
  }

  // "New List" card
  const newListCard = document.createElement('div');
  newListCard.className = 'todo-new-list';
  newListCard.innerHTML = '<span class="todo-new-list-icon">+</span><span>New List</span>';
  newListCard.addEventListener('click', () => {
    data.lists.push({
      id: uid(),
      title: 'New List',
      tasks: [],
    });
    onChange();
    renderTodoBoard(wrapper, data, onChange);
    // Focus the title of the last tile for editing
    const tiles = wrapper.querySelectorAll('.todo-tile');
    const lastTile = tiles[tiles.length - 1];
    if (lastTile) {
      const titleEl = lastTile.querySelector('.todo-tile-title');
      if (titleEl) startEditTitle(titleEl, list => list, data, onChange, wrapper);
    }
  });
  grid.appendChild(newListCard);

  board.appendChild(grid);
  wrapper.appendChild(board);
}

function createListTile(list, data, onChange) {
  const tile = document.createElement('div');
  tile.className = 'todo-tile';
  tile.dataset.listId = list.id;

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
        action: () => confirmDeleteList(tile, list, data, onChange),
      },
    ]);
  });

  // Task list
  const taskBody = document.createElement('div');
  taskBody.className = 'todo-tile-body';

  for (const task of list.tasks) {
    const taskEl = createTaskElement(task, list, data, onChange, taskBody);
    taskBody.appendChild(taskEl);
  }
  tile.appendChild(taskBody);

  // Add task input
  const footer = document.createElement('div');
  footer.className = 'todo-tile-footer';

  const addInput = document.createElement('input');
  addInput.className = 'todo-add-input';
  addInput.type = 'text';
  addInput.placeholder = 'Add a new task...';
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && addInput.value.trim()) {
      const newTask = { id: uid(), text: addInput.value.trim(), done: false };
      list.tasks.push(newTask);
      onChange();

      const taskEl = createTaskElement(newTask, list, data, onChange, taskBody);
      taskBody.appendChild(taskEl);
      addInput.value = '';

      // Scroll to bottom
      taskBody.scrollTop = taskBody.scrollHeight;
    }
  });

  footer.appendChild(addInput);
  tile.appendChild(footer);

  return tile;
}

function createTaskElement(task, list, data, onChange, taskBody) {
  const taskEl = document.createElement('div');
  taskEl.className = 'todo-task';
  if (task.done) taskEl.classList.add('done');
  taskEl.dataset.taskId = task.id;

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.className = 'todo-task-checkbox';
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

  return taskEl;
}

function confirmDeleteList(tile, list, data, onChange) {
  if (!confirm(`Delete list "${list.title}"?`)) return;
  const idx = data.lists.findIndex(l => l.id === list.id);
  if (idx !== -1) {
    data.lists.splice(idx, 1);
    onChange();
    tile.style.opacity = '0';
    tile.style.transform = 'scale(0.95)';
    setTimeout(() => {
      tile.remove();
      if (data.lists.length === 0) {
        const wrapper = tile.closest('.todo-board')?.parentElement;
        if (wrapper) renderTodoBoard(wrapper, data, onChange);
      }
    }, 200);
  }
}

function startEditTask(textSpan, task, onChange) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-task-edit-input';
  input.value = task.text;

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newText = input.value.trim();
    if (newText && newText !== task.text) {
      task.text = newText;
      onChange();
    }
    textSpan.textContent = task.text;
    input.replaceWith(textSpan);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.value = task.text; // reset
      input.blur();
    }
  });
}

function startEditTitleInline(titleSpan, list, data, onChange) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-title-edit-input';
  input.value = list.title;

  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== list.title) {
      list.title = newTitle;
      onChange();
    }
    titleSpan.textContent = list.title;
    input.replaceWith(titleSpan);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.value = list.title;
      input.blur();
    }
  });
}

// Legacy — kept for the "new list" flow
function startEditTitle(titleEl, getList, data, onChange, wrapper) {
  const list = data.lists[data.lists.length - 1];
  if (!list) return;
  startEditTitleInline(titleEl, list, data, onChange);
}


