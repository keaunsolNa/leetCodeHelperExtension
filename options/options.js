const FIELDS = ['githubToken', 'githubOwner', 'githubRepo', 'basePath', 'groqApiKey'];

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(FIELDS, (settings) => {
    FIELDS.forEach((key) => {
      if (settings[key]) document.getElementById(key).value = settings[key];
    });
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const values = {};
    FIELDS.forEach((key) => {
      values[key] = document.getElementById(key).value.trim();
    });
    chrome.storage.sync.set(values, () => {
      const el = document.getElementById('status');
      el.textContent = '설정이 저장되었습니다.';
      setTimeout(() => { el.textContent = ''; }, 2000);
    });
  });
});
