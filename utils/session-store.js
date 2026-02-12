const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = path.join(os.homedir(), '.md-editor');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * Save the current session (open file paths and active tab index).
 * @param {{files: string[], activeIndex: number}} session
 */
function saveSession(session) {
  try {
    ensureDir();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save session:', err.message);
  }
}

/**
 * Load the saved session.
 * @returns {{files: string[], activeIndex: number} | null}
 */
function loadSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const data = fs.readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load session:', err.message);
    return null;
  }
}

module.exports = { saveSession, loadSession };
