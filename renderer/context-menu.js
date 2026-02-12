/**
 * Lightweight custom context menu.
 * Usage:
 *   showContextMenu(x, y, [
 *     { label: 'Cut', shortcut: 'Ctrl+X', action: () => { ... } },
 *     { separator: true },
 *     { label: 'Disabled item', disabled: true },
 *   ]);
 */

let menuEl = null;

function ensureMenuElement() {
  if (menuEl) return menuEl;
  menuEl = document.createElement('div');
  menuEl.className = 'context-menu hidden';
  menuEl.setAttribute('role', 'menu');
  document.body.appendChild(menuEl);
  return menuEl;
}

function hide() {
  if (menuEl) {
    menuEl.classList.add('hidden');
    menuEl.innerHTML = '';
  }
}

// Close on any click outside or Escape
document.addEventListener('mousedown', (e) => {
  if (menuEl && !menuEl.contains(e.target)) {
    hide();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hide();
});
window.addEventListener('blur', hide);

/**
 * Show a context menu at (x, y) with the given items.
 * @param {number} x - Viewport X
 * @param {number} y - Viewport Y
 * @param {Array<{label?: string, shortcut?: string, action?: Function, disabled?: boolean, separator?: boolean}>} items
 */
export function showContextMenu(x, y, items) {
  const menu = ensureMenuElement();
  menu.innerHTML = '';

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      continue;
    }

    const row = document.createElement('div');
    row.className = 'context-menu-item';
    row.setAttribute('role', 'menuitem');

    if (item.disabled) {
      row.classList.add('disabled');
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'context-menu-label';
    labelSpan.textContent = item.label || '';
    row.appendChild(labelSpan);

    if (item.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'context-menu-shortcut';
      shortcutSpan.textContent = item.shortcut;
      row.appendChild(shortcutSpan);
    }

    if (!item.disabled && item.action) {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        item.action();
      });
    }

    menu.appendChild(row);
  }

  // Position, then show so we can measure
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.classList.remove('hidden');

  // Clamp to viewport
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let posX = x;
  let posY = y;
  if (posX + rect.width > vw) posX = vw - rect.width - 4;
  if (posY + rect.height > vh) posY = vh - rect.height - 4;
  if (posX < 0) posX = 4;
  if (posY < 0) posY = 4;

  menu.style.left = posX + 'px';
  menu.style.top = posY + 'px';
}

export function hideContextMenu() {
  hide();
}
