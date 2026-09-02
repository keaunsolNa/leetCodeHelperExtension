// Runs in isolated world — has chrome APIs

let storedProblem = null;
let reloadNoticeShown = false;

// 확장을 새로고침하거나 스토어 업데이트가 적용되면, 이미 열려 있던 탭에 주입된
// 이 스크립트는 고아가 된다. chrome.runtime.id 가 undefined 로 바뀌고
// sendMessage 는 "Extension context invalidated" 를 던진다.
// 사용자 입장에서는 정답을 맞혔는데 아무 일도 일어나지 않는 상황이므로,
// 조용히 삼키지 말고 새로고침을 안내해야 한다.
function isExtensionAlive() {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function showReloadNotice() {
  if (reloadNoticeShown || !document.body) return;
  reloadNoticeShown = true;

  const box = document.createElement('div');
  // 페이지 CSP 가 인라인 style 속성을 막을 수 있어 CSSOM 으로 지정한다.
  Object.assign(box.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '2147483647',
    maxWidth: '320px',
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
    font: '13px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  });
  box.textContent =
    'LeetCode Helper가 업데이트되어 이 탭과의 연결이 끊겼습니다. ' +
    '페이지를 새로고침한 뒤 다시 제출해 주세요.';

  const button = document.createElement('button');
  Object.assign(button.style, {
    display: 'block',
    marginTop: '10px',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    background: '#92400e',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  });
  button.textContent = '새로고침';
  button.addEventListener('click', () => location.reload());

  box.appendChild(button);
  document.body.appendChild(box);
}

function sendToBackground(message) {
  if (!isExtensionAlive()) {
    showReloadNotice();
    return;
  }
  try {
    // MV3 에서는 Promise 를 돌려준다. 서비스 워커가 사라진 순간과 겹치면
    // 동기 예외가 아니라 거절로 나타나므로 양쪽을 모두 잡는다.
    chrome.runtime.sendMessage(message)?.catch?.(() => showReloadNotice());
  } catch {
    showReloadNotice();
  }
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.data?.source !== 'lc-helper') return;

  const { type, payload } = e.data;

  if (type === 'QUESTION_DATA') {
    storedProblem = payload;
  } else if (type === 'SUBMISSION_DETAILS') {
    if (payload.statusMsg !== 'Accepted') return;
    sendToBackground({
      type: 'SUBMISSION_ACCEPTED',
      ...(storedProblem || {}),
      lang: payload.lang,
      code: payload.code,
      runtime: payload.runtimeDisplay,
      runtimePercentile: payload.runtimePercentile,
      memory: payload.memoryDisplay,
      memoryPercentile: payload.memoryPercentile,
    });
  }
});
