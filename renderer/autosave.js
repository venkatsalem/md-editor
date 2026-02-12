const AUTOSAVE_DELAY = 2000; // 2 seconds debounce
const RETRY_DELAY = 5000;   // 5 seconds retry on failure

/**
 * Creates an auto-save controller for a tab.
 * @param {Function} getSaveData - Returns { filePath, content } for saving
 * @param {Function} onSaveSuccess - Called after successful save
 * @param {Function} onSaveError - Called on save failure with error message
 * @returns {{ trigger: Function, saveNow: Function, cancel: Function }}
 */
export function createAutoSave(getSaveData, onSaveSuccess, onSaveError) {
  let debounceTimer = null;
  let retryTimer = null;

  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  async function performSave() {
    const data = getSaveData();
    if (!data || !data.filePath) return; // Don't save untitled files

    try {
      const result = await window.electronAPI.saveFile(data.filePath, data.content);
      if (result.success) {
        onSaveSuccess();
      } else {
        onSaveError(result.error || 'Unknown error');
        // Retry after delay
        retryTimer = setTimeout(performSave, RETRY_DELAY);
      }
    } catch (err) {
      onSaveError(err.message || 'Save failed');
      retryTimer = setTimeout(performSave, RETRY_DELAY);
    }
  }

  /**
   * Trigger a debounced auto-save.
   */
  function trigger() {
    cancel();
    debounceTimer = setTimeout(performSave, AUTOSAVE_DELAY);
  }

  /**
   * Save immediately (e.g., on blur).
   */
  async function saveNow() {
    cancel();
    await performSave();
  }

  return { trigger, saveNow, cancel };
}
