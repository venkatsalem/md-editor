const fs = require('fs');
const path = require('path');
const os = require('os');

const RECENT_DIR = path.join(os.homedir(), '.md-editor');
const RECENT_FILE = path.join(RECENT_DIR, 'recent.json');
const MAX_RECENT = 10;

function ensureDir() {
  if (!fs.existsSync(RECENT_DIR)) {
    fs.mkdirSync(RECENT_DIR, { recursive: true });
  }
}

/**
 * Get the list of recent files.
 * @returns {string[]}
 */
function getRecentFiles() {
  try {
    if (!fs.existsSync(RECENT_FILE)) return [];
    const data = fs.readFileSync(RECENT_FILE, 'utf-8');
    const files = JSON.parse(data);
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

/**
 * Add a file path to the recent files list.
 * Moves it to the top if it already exists.
 * @param {string} filePath
 */
function addRecentFile(filePath) {
  try {
    ensureDir();
    let files = getRecentFiles();
    // Remove if already present
    files = files.filter(f => f !== filePath);
    // Add to front
    files.unshift(filePath);
    // Trim to max
    if (files.length > MAX_RECENT) {
      files = files.slice(0, MAX_RECENT);
    }
    fs.writeFileSync(RECENT_FILE, JSON.stringify(files, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to update recent files:', err.message);
  }
}

/**
 * Clear all recent files.
 */
function clearRecentFiles() {
  try {
    ensureDir();
    fs.writeFileSync(RECENT_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to clear recent files:', err.message);
  }
}

module.exports = { getRecentFiles, addRecentFile, clearRecentFiles };
