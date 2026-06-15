document.getElementById('optionsLink').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get('lastStatus', ({ lastStatus }) => {
  if (lastStatus) renderStatus(lastStatus);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') renderStatus(msg);
});

function renderStatus({ status, message, timestamp }) {
  const box = document.getElementById('statusBox');
  box.className = status || '';
  const icons = { success: '✅ ', error: '❌ ', skip: '⏭️ ' };
  box.textContent = (icons[status] || '') + message;
  if (timestamp) {
    document.getElementById('ts').textContent =
      new Date(timestamp).toLocaleString('ko-KR');
  }
}
