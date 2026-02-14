/**
 * Lightweight GitHub-flavored Markdown to HTML renderer.
 * No external dependencies — pure string parsing.
 *
 * Supports: headings, bold, italic, strikethrough, inline code,
 * code blocks (fenced), links, images, blockquotes, ordered/unordered lists,
 * task lists (with clickable checkboxes), tables, horizontal rules, paragraphs,
 * line breaks, and auto-linked URLs.
 */

// --- Inline rendering ---

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  let out = escapeHtml(text);

  // Inline code (backtick) — must come before other inline transforms
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images: ![alt](src)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Bold + italic: ***text*** or ___text___
  out = out.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  out = out.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');

  // Bold: **text** or __text__
  out = out.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  out = out.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Auto-link bare URLs (only those not already inside an href or src)
  out = out.replace(/(?<!["=])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // Line break: two trailing spaces or backslash at EOL
  out = out.replace(/ {2,}$/gm, '<br>');

  return out;
}

// --- Block-level parsing ---

/**
 * Parse a fenced code block starting at lineIndex.
 * Returns { html, endIndex }.
 */
function parseCodeBlock(lines, startIndex) {
  const openMatch = lines[startIndex].match(/^(`{3,}|~{3,})\s*(.*)?$/);
  if (!openMatch) return null;

  const fence = openMatch[1];
  const lang = (openMatch[2] || '').trim();
  const closeFence = fence[0].repeat(fence.length);
  const codeLines = [];

  let i = startIndex + 1;
  while (i < lines.length) {
    if (lines[i].trimEnd() === closeFence || lines[i].startsWith(closeFence)) {
      break;
    }
    codeLines.push(lines[i]);
    i++;
  }

  const code = escapeHtml(codeLines.join('\n'));
  const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  const html = `<pre><code${langAttr}>${code}</code></pre>`;

  return { html, endIndex: i };
}

/**
 * Parse a table starting at lineIndex.
 * Returns { html, endIndex } or null.
 */
function parseTable(lines, startIndex) {
  if (startIndex + 1 >= lines.length) return null;

  const headerLine = lines[startIndex].trim();
  const separatorLine = lines[startIndex + 1].trim();

  // Separator must be like | --- | --- | or --- | ---
  if (!/^[\s|:-]+$/.test(separatorLine) || !separatorLine.includes('-')) return null;

  function parseCells(line) {
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|')) l = l.slice(0, -1);
    return l.split('|').map(c => c.trim());
  }

  const headers = parseCells(headerLine);
  const sepCells = parseCells(separatorLine);

  // Validate separator cells
  const validSep = sepCells.every(c => /^:?-+:?$/.test(c));
  if (!validSep) return null;

  // Determine alignment
  const aligns = sepCells.map(c => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  let html = '<table>\n<thead>\n<tr>\n';
  headers.forEach((h, idx) => {
    const align = aligns[idx] || 'left';
    html += `<th align="${align}">${renderInline(h)}</th>\n`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';

  let i = startIndex + 2;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || (!line.includes('|') && !line.startsWith('|'))) break;

    const cells = parseCells(line);
    html += '<tr>\n';
    headers.forEach((_, idx) => {
      const align = aligns[idx] || 'left';
      const cell = cells[idx] || '';
      html += `<td align="${align}">${renderInline(cell)}</td>\n`;
    });
    html += '</tr>\n';
    i++;
  }

  html += '</tbody>\n</table>';
  return { html, endIndex: i - 1 };
}

/**
 * Parse a list (ordered or unordered) starting at lineIndex.
 * Returns { html, endIndex }.
 */
function parseList(lines, startIndex) {
  const firstLine = lines[startIndex];
  const isOrdered = /^\s*\d+\.\s/.test(firstLine);
  const tag = isOrdered ? 'ol' : 'ul';

  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);

    const match = isOrdered ? olMatch : ulMatch;
    if (!match && i > startIndex) break;
    if (!match) break;

    let content = match[3];

    // Check for task list: - [ ] or - [x]
    const taskMatch = content.match(/^\[([ xX]?)\]\s*(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1] === 'x' || taskMatch[1] === 'X';
      const taskContent = taskMatch[2];
      const checkedAttr = checked ? ' checked disabled' : ' disabled';
      content = `<input type="checkbox" class="md-preview-checkbox"${checkedAttr}> ${renderInline(taskContent)}`;
      items.push({ content, isTask: true });
    } else {
      items.push({ content: renderInline(content), isTask: false });
    }

    i++;

    // Gather continuation lines (indented, not a new list item)
    while (i < lines.length) {
      const nextLine = lines[i];
      // Blank line might separate list items but a following list item continues
      if (nextLine.trim() === '') {
        // Peek: if next non-blank line is a list item, keep going
        if (i + 1 < lines.length && (isOrdered ? /^\s*\d+\.\s/.test(lines[i + 1]) : /^\s*[-*+]\s/.test(lines[i + 1]))) {
          i++;
          break;
        }
        break;
      }
      // Continuation line (indented)
      if (/^\s{2,}/.test(nextLine) && !(isOrdered ? /^\s*\d+\.\s/.test(nextLine) : /^\s*[-*+]\s/.test(nextLine))) {
        const lastItem = items[items.length - 1];
        lastItem.content += ' ' + renderInline(nextLine.trim());
        i++;
      } else {
        break;
      }
    }
  }

  let html = `<${tag}>\n`;
  for (const item of items) {
    const cls = item.isTask ? ' class="task-list-item"' : '';
    html += `<li${cls}>${item.content}</li>\n`;
  }
  html += `</${tag}>`;

  return { html, endIndex: i - 1 };
}

/**
 * Parse a blockquote starting at lineIndex.
 * Returns { html, endIndex }.
 */
function parseBlockquote(lines, startIndex) {
  const quoteLines = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (line.match(/^>\s?/)) {
      quoteLines.push(line.replace(/^>\s?/, ''));
      i++;
    } else if (line.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^>\s?/)) {
      // Blank line between blockquote paragraphs
      quoteLines.push('');
      i++;
    } else {
      break;
    }
  }

  // Recursively render blockquote content
  const innerHtml = renderMarkdown(quoteLines.join('\n'));
  const html = `<blockquote>${innerHtml}</blockquote>`;

  return { html, endIndex: i - 1 };
}

/**
 * Main render function: converts markdown string to HTML string.
 * @param {string} md - Raw markdown text
 * @returns {string} HTML string
 */
export function renderMarkdown(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // --- Blank line ---
    if (trimmed === '') {
      i++;
      continue;
    }

    // --- Fenced code block ---
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      const result = parseCodeBlock(lines, i);
      if (result) {
        blocks.push(result.html);
        i = result.endIndex + 1;
        continue;
      }
    }

    // --- Horizontal rule ---
    if (/^([-*_])\s*\1\s*\1[\s\-*_]*$/.test(trimmed) && trimmed.replace(/\s/g, '').length >= 3) {
      blocks.push('<hr>');
      i++;
      continue;
    }

    // --- Heading (ATX) ---
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*?)(?:\s+#*)?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      // Generate an id for anchor links
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      blocks.push(`<h${level} id="${escapeHtml(id)}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    // --- Table ---
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const result = parseTable(lines, i);
      if (result) {
        blocks.push(result.html);
        i = result.endIndex + 1;
        continue;
      }
    }

    // --- Blockquote ---
    if (trimmed.startsWith('>')) {
      const result = parseBlockquote(lines, i);
      blocks.push(result.html);
      i = result.endIndex + 1;
      continue;
    }

    // --- List (unordered or ordered) ---
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      const result = parseList(lines, i);
      blocks.push(result.html);
      i = result.endIndex + 1;
      continue;
    }

    // --- Paragraph (collect consecutive non-blank lines) ---
    const paraLines = [];
    while (i < lines.length) {
      const pLine = lines[i];
      const pTrimmed = pLine.trim();
      if (pTrimmed === '') break;
      if (/^#{1,6}\s/.test(pTrimmed)) break;
      if (/^(`{3,}|~{3,})/.test(pTrimmed)) break;
      if (/^>\s?/.test(pLine)) break;
      if (/^\s*[-*+]\s/.test(pLine) && paraLines.length === 0) break;
      if (/^\s*\d+\.\s/.test(pLine) && paraLines.length === 0) break;
      if (/^([-*_])\s*\1\s*\1[\s\-*_]*$/.test(pTrimmed) && pTrimmed.replace(/\s/g, '').length >= 3) break;
      if (pTrimmed.includes('|') && i + 1 < lines.length && /^[\s|:-]+$/.test((lines[i + 1] || '').trim()) && (lines[i + 1] || '').includes('-')) break;
      paraLines.push(pLine);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${renderInline(paraLines.join('\n'))}</p>`);
    } else {
      // Safety: skip line to avoid infinite loop
      i++;
    }
  }

  return blocks.join('\n');
}

/**
 * Create a preview DOM element for a given markdown string.
 * @param {string} markdownContent - Raw markdown text
 * @returns {HTMLElement} A div with class "markdown-preview" containing rendered HTML
 */
export function createPreviewElement(markdownContent) {
  const div = document.createElement('div');
  div.className = 'markdown-preview';
  div.innerHTML = renderMarkdown(markdownContent);
  return div;
}
