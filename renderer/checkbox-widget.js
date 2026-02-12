import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view';

/**
 * Regex to match markdown task list items:
 *   - [ ] unchecked
 *   - [] unchecked (empty brackets)
 *   - [x] or - [X] checked
 * Also supports * and + as list markers, with optional leading whitespace.
 */
const TASK_RE = /^(\s*[-*+]\s+)\[([ xX]?)\]/;

class CheckboxWidget extends WidgetType {
  constructor(checked, bracketStart, bracketLen) {
    super();
    this.checked = checked;
    this.bracketStart = bracketStart; // position of '[' in the document
    this.bracketLen = bracketLen;     // length of the full bracket group: 2 for [], 3 for [ ] or [x]
  }

  eq(other) {
    return this.checked === other.checked && this.bracketStart === other.bracketStart;
  }

  toDOM(view) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this.checked;
    cb.className = 'cm-task-checkbox';
    cb.setAttribute('aria-label', this.checked ? 'Completed task' : 'Incomplete task');

    cb.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    cb.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Replace the entire bracket group with the toggled version
      const newBracket = this.checked ? '[ ]' : '[x]';
      view.dispatch({
        changes: {
          from: this.bracketStart,
          to: this.bracketStart + this.bracketLen,
          insert: newBracket,
        },
      });
      view.focus();
    });

    return cb;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view) {
  const decorations = [];
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const match = TASK_RE.exec(line.text);
    if (!match) continue;

    const prefix = match[1];      // e.g. "- " or "  * "
    const checkChar = match[2];   // ' ', 'x', 'X', or '' (empty)
    const checked = checkChar === 'x' || checkChar === 'X';

    // Position of '[' in the document
    const bracketStart = line.from + prefix.length;
    // Full matched bracket: [] is 2 chars, [ ] or [x] is 3 chars
    const bracketLen = checkChar === '' ? 2 : 3;

    const deco = Decoration.replace({
      widget: new CheckboxWidget(checked, bracketStart, bracketLen),
    });

    decorations.push(deco.range(bracketStart, bracketStart + bracketLen));
  }

  return Decoration.set(decorations);
}

/**
 * CodeMirror 6 plugin that renders inline checkboxes for markdown task lists.
 * Handles `- [ ]`, `- []`, and `- [x]` patterns.
 * Clicking a checkbox toggles the state in the source text.
 */
export const checkboxPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
