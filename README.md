# MD Editor

A lightweight, fast, multi-tab markdown editor built with Electron and CodeMirror 6.

Designed to do one thing well — edit markdown files with minimal overhead and maximum speed.

## Features

- **Multi-tab editing** — open multiple files, drag to reorder, middle-click to close
- **Markdown syntax highlighting** — muted, Sublime-like colors via CodeMirror 6
- **System theme** — automatically follows OS light/dark mode, switches in real time
- **Auto-save** — saves 2 seconds after you stop typing; saves all tabs on focus loss
- **Session restore** — reopens your files, active tab, tab order, and zoom level on next launch
- **Recent files** — tracks last 10 opened files in File > Open Recent
- **Single instance** — opening a file while the app is running adds it as a new tab
- **Todo board** — open `.todo.json` files as a card-based task board (see below)
- **Drag and drop** — drop `.md` or `.json` files onto the window to open them
- **Find/Replace** — Ctrl+F / Ctrl+H with CodeMirror's built-in search
- **Read-only mode** — Ctrl+Shift+R to toggle GitHub-style markdown preview
- **Inline checkboxes** — clickable checkboxes for `- [ ]` / `- [x]` task lists in markdown
- **Context menus** — right-click tabs (Close, Close Others, Close All, Copy Path) and editor (Cut, Copy, Paste, Undo, Redo, Find, Replace, Select All)
- **Frameless window** — custom titlebar with centered tabs and draggable regions
- **File association** — register as handler for `.md` files

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| New File | Ctrl+N |
| Open File | Ctrl+O |
| Save | Ctrl+S |
| Save As | Ctrl+Shift+S |
| Close Tab | Ctrl+W |
| Next Tab | Ctrl+Tab |
| Previous Tab | Ctrl+Shift+Tab |
| Find | Ctrl+F |
| Replace | Ctrl+H |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Zoom In | Ctrl+= |
| Zoom Out | Ctrl+- |
| Reset Zoom | Ctrl+0 |
| Toggle Read-Only | Ctrl+Shift+R |
| Quit | Ctrl+Q |

## Todo Board

Open any `.json` file with the following structure and it renders as an interactive task board:

```json
{
  "lists": [
    {
      "id": "list-1",
      "title": "My Tasks",
      "tasks": [
        { "id": "t1", "text": "Buy groceries", "done": false },
        { "id": "t2", "text": "Review PR", "done": true }
      ]
    }
  ]
}
```

- Click the **checkbox** to mark a task as done
- **Double-click** a task or list title to edit it in-place
- **Right-click** a list header for Rename / Delete options
- **Right-click** a task for Edit / Delete options
- Completed tasks show a **delete icon** for quick removal
- Type in the bottom row and press **Enter** to add a new task
- Click the **+ New List** card to create a new list
- Changes are **auto-saved** to the `.json` file
- A sample file is included at `samples/todo.json`

## Getting Started

```bash
# Install dependencies
npm install

# Build renderer bundle and launch
npm start
```

## Scripts

| Command | Description |
|---|---|
| `npm start` | Build and launch the app |
| `npm run dev` | Same as start |
| `npm run build:renderer` | Bundle renderer JS with esbuild |
| `npm run watch:renderer` | Watch mode for renderer bundle |
| `npm run build` | Package for current platform |
| `npm run build:win` | Package for Windows (.exe) |
| `npm run build:mac` | Package for macOS (.dmg) |
| `npm run build:linux` | Package for Linux (.AppImage) |

## Create Desktop Shortcut (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
```

## Project Structure

```
md-editor/
  main.js                  Main process — window, menus, IPC, session, single instance
  preload.js               Secure contextBridge IPC API
  esbuild.config.js        Bundles renderer ES modules
  icon.png                 App icon (PNG)
  icon.ico                 App icon (Windows)
  create-shortcut.ps1      Creates a desktop shortcut on Windows
  renderer/
    index.html             Frameless window with custom titlebar
    styles.css             Light/dark theme via CSS variables
    renderer.js            Entry point — wires IPC, shortcuts, drag-drop, context menus
    tab-manager.js         Tab CRUD, reordering, switching, session data
    editor-manager.js      CodeMirror 6 setup, dual themes, compartments
    autosave.js            Debounced auto-save with retry
    context-menu.js        Reusable right-click context menu
    checkbox-widget.js     CM6 plugin — inline checkboxes for task lists
    markdown-preview.js    Lightweight GFM-to-HTML renderer for read-only mode
    todo-renderer.js       Todo board UI — card-based task list for .json files
  samples/
    todo.json              Example todo file
  utils/
    file-ops.js            Async file read/write/exists
    session-store.js       ~/.md-editor/session.json persistence
    recent-files.js        ~/.md-editor/recent.json tracking
```

## Tech Stack

- **Electron** — desktop shell
- **CodeMirror 6** — editor engine
- **esbuild** — renderer bundler
- **electron-builder** — packaging

## Data Storage

Session and preferences are stored in `~/.md-editor/`:

- `session.json` — open files, active tab index, zoom level
- `recent.json` — last 10 opened file paths

## License

MIT
