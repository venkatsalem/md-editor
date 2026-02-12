const fs = require('fs');
const path = require('path');

/**
 * Read a file and return its content.
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function readFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Write content to a file.
 * @param {string} filePath - Absolute path to the file
 * @param {string} content - Content to write
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function writeFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if a file exists.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = { readFile, writeFile, fileExists };
