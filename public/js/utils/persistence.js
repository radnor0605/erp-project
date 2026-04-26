/* ─── Form State Persistence Utility (V9.9.2) ─── */
const FormPersistence = (() => {
  const PREFIX = 'ag_form_state_';

  function getStorage(type = 'local') {
    return type === 'session' ? sessionStorage : localStorage;
  }

  /**
   * Save form data to storage
   */
  function save(formId, data, storageType = 'local') {
    getStorage(storageType).setItem(PREFIX + formId, JSON.stringify(data));
  }

  /**
   * Load form data from storage
   */
  function load(formId, storageType = 'local') {
    const saved = getStorage(storageType).getItem(PREFIX + formId);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  /**
   * Clear form data from storage
   */
  function clear(formId, storageType = 'local') {
    getStorage(storageType).removeItem(PREFIX + formId);
  }

  /**
   * Bind a form to auto-save its inputs
   */
  function bind(formId, formElement, storageType = 'local') {
    if (!formElement) return;
    
    // Initial Load
    const savedData = load(formId, storageType);
    if (savedData) {
      Object.keys(savedData).forEach(key => {
        const input = formElement.querySelector(`[name="${key}"], #${key}`);
        if (input) {
          if (input.type === 'checkbox') input.checked = !!savedData[key];
          else if (input.type === 'radio') {
             const radio = formElement.querySelector(`[name="${key}"][value="${savedData[key]}"]`);
             if (radio) radio.checked = true;
          } else {
            input.value = savedData[key];
          }
        }
      });
    }

    // Auto-Save on Input
    formElement.addEventListener('input', () => {
      const formData = new FormData(formElement);
      const data = {};
      formData.forEach((value, key) => {
        if (data[key]) {
          if (!Array.isArray(data[key])) data[key] = [data[key]];
          data[key].push(value);
        } else {
          data[key] = value;
        }
      });
      save(formId, data, storageType);
    });
  }

  /**
   * Universal Restore: Restore data to a form
   */
  function restore(formId, formElement, storageType = 'local') {
    if (!formElement) return;
    const data = load(formId, storageType);
    if (!data) return;

    Object.keys(data).forEach(key => {
      const inputs = formElement.querySelectorAll(`[name="${key}"], #${key}`);
      inputs.forEach((input, idx) => {
        const val = Array.isArray(data[key]) ? data[key][idx] : data[key];
        if (val === undefined) return;
        if (input.type === 'checkbox') input.checked = !!val;
        else if (input.type === 'radio') {
          if (input.value === val) input.checked = true;
        } else {
          input.value = val;
        }
      });
    });
  }

  return { save, load, clear, bind, restore };
})();

window.FormPersistence = FormPersistence;
