import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, HighlightStyle, indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, openSearchPanel, replaceAll } from '@codemirror/search';
import { tags } from '@lezer/highlight';

// Compartments for toggleable features
const wordWrapCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const themeCompartment = new Compartment();

let wordWrapEnabled = true;
let lineNumbersEnabled = true;
let currentTheme = 'dark'; // 'dark' | 'light'

// ===== Dark Theme =====
const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#e8a838', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading2, color: '#e8a838', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#e8a838', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: '#e8a838', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#c5a5c5', fontStyle: 'italic' },
  { tag: tags.strong, color: '#d4976c', fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#7a7a7a' },
  { tag: tags.link, color: '#6796e6', textDecoration: 'underline' },
  { tag: tags.url, color: '#6796e6' },
  { tag: tags.monospace, color: '#ce9178', backgroundColor: 'rgba(255,255,255,0.05)' },
  { tag: tags.quote, color: '#8a8a8a', fontStyle: 'italic' },
  { tag: tags.list, color: '#b5cea8' },
  { tag: tags.contentSeparator, color: '#3c3c3c' },
  { tag: tags.processingInstruction, color: '#808080' },
  { tag: tags.meta, color: '#808080' },
  { tag: tags.comment, color: '#6a9955' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.punctuation, color: '#808080' },
  { tag: tags.labelName, color: '#dcdcaa' },
]);

const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
  },
  '.cm-content': {
    caretColor: '#ffffff',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    padding: '4px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#ffffff',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(0, 122, 204, 0.3)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  '.cm-gutters': {
    backgroundColor: '#252526',
    color: '#858585',
    borderRight: '1px solid #3c3c3c',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#c6c6c6',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6a9955',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 16px',
    minWidth: '40px',
  },
}, { dark: true });

// ===== Light Theme =====
const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#0550ae', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading2, color: '#0550ae', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#0550ae', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: '#0550ae', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#8250df', fontStyle: 'italic' },
  { tag: tags.strong, color: '#953800', fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#8b949e' },
  { tag: tags.link, color: '#0969da', textDecoration: 'underline' },
  { tag: tags.url, color: '#0969da' },
  { tag: tags.monospace, color: '#953800', backgroundColor: 'rgba(175,184,193,0.2)' },
  { tag: tags.quote, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.list, color: '#116329' },
  { tag: tags.contentSeparator, color: '#d1d5da' },
  { tag: tags.processingInstruction, color: '#6e7781' },
  { tag: tags.meta, color: '#6e7781' },
  { tag: tags.comment, color: '#6e7781' },
  { tag: tags.string, color: '#0a3069' },
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.operator, color: '#24292f' },
  { tag: tags.punctuation, color: '#6e7781' },
  { tag: tags.labelName, color: '#0550ae' },
]);

const lightEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#24292f',
  },
  '.cm-content': {
    caretColor: '#1e1e1e',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    padding: '4px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#1e1e1e',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(9, 105, 218, 0.2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '.cm-gutters': {
    backgroundColor: '#f3f3f3',
    color: '#6e7681',
    borderRight: '1px solid #d1d5da',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#24292f',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#116329',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 16px',
    minWidth: '40px',
  },
}, { dark: false });

function getThemeExtensions(theme) {
  if (theme === 'light') {
    return [lightEditorTheme, syntaxHighlighting(lightHighlight)];
  }
  return [darkEditorTheme, syntaxHighlighting(darkHighlight)];
}

/**
 * Create a CodeMirror 6 editor instance.
 * @param {HTMLElement} parent - DOM element to mount the editor in
 * @param {string} content - Initial document content
 * @param {Function} onChange - Callback for content changes
 * @returns {EditorView}
 */
export function createEditor(parent, content = '', onChange = null) {
  const extensions = [
    // Line numbers (toggleable)
    lineNumbersCompartment.of(lineNumbersEnabled ? lineNumbers() : []),
    // Word wrap (toggleable)
    wordWrapCompartment.of(wordWrapEnabled ? EditorView.lineWrapping : []),
    // Core
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    rectangularSelection(),
    highlightActiveLine(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    indentUnit.of('  '),
    // Theme (toggleable via compartment)
    themeCompartment.of(getThemeExtensions(currentTheme)),
    // Language
    markdown({ base: markdownLanguage }),
    // Keymaps
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    // Update listener for change tracking
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    }),
    // Placeholder for empty files
    placeholder('Start writing markdown...'),
  ];

  const state = EditorState.create({
    doc: content,
    extensions,
  });

  const view = new EditorView({
    state,
    parent,
  });

  return view;
}

/**
 * Set the content of an editor, replacing all existing content.
 * @param {EditorView} view
 * @param {string} content
 */
export function setEditorContent(view, content) {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content,
    },
  });
}

/**
 * Get the current content of an editor.
 * @param {EditorView} view
 * @returns {string}
 */
export function getEditorContent(view) {
  return view.state.doc.toString();
}

/**
 * Perform undo on the editor.
 * @param {EditorView} view
 */
export function editorUndo(view) {
  undo(view);
}

/**
 * Perform redo on the editor.
 * @param {EditorView} view
 */
export function editorRedo(view) {
  redo(view);
}

/**
 * Open the search panel.
 * @param {EditorView} view
 */
export function editorFind(view) {
  openSearchPanel(view);
}

/**
 * Open the search panel (replace mode is toggled by user in the panel).
 * @param {EditorView} view
 */
export function editorReplace(view) {
  openSearchPanel(view);
}

/**
 * Set font size on the editor.
 * @param {EditorView} view
 * @param {number} size
 */
export function setFontSize(view, size) {
  const editorEl = view.dom;
  editorEl.style.fontSize = size + 'px';
  // Force CodeMirror to recalculate
  view.requestMeasure();
}

/**
 * Toggle word wrap for all editors.
 * @param {EditorView[]} views - Array of all editor views
 * @returns {boolean} New state
 */
export function toggleWordWrap(views) {
  wordWrapEnabled = !wordWrapEnabled;
  const effect = wordWrapCompartment.reconfigure(
    wordWrapEnabled ? EditorView.lineWrapping : []
  );
  views.forEach(view => {
    view.dispatch({ effects: effect });
  });
  return wordWrapEnabled;
}

/**
 * Toggle line numbers for all editors.
 * @param {EditorView[]} views - Array of all editor views
 * @returns {boolean} New state
 */
export function toggleLineNumbers(views) {
  lineNumbersEnabled = !lineNumbersEnabled;
  const effect = lineNumbersCompartment.reconfigure(
    lineNumbersEnabled ? lineNumbers() : []
  );
  views.forEach(view => {
    view.dispatch({ effects: effect });
  });
  return lineNumbersEnabled;
}

/**
 * Apply a theme to all editors.
 * @param {EditorView[]} views - Array of all editor views
 * @param {'dark'|'light'} theme - Theme name
 */
export function applyTheme(views, theme) {
  currentTheme = theme;
  const effect = themeCompartment.reconfigure(getThemeExtensions(theme));
  views.forEach(view => {
    view.dispatch({ effects: effect });
  });
}

/**
 * Get the current theme name.
 * @returns {'dark'|'light'}
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Set initial theme before any editors are created.
 * @param {'dark'|'light'} theme
 */
export function setInitialTheme(theme) {
  currentTheme = theme;
}

/**
 * Focus the editor.
 * @param {EditorView} view
 */
export function focusEditor(view) {
  view.focus();
}
