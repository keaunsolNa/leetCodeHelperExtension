// Runs in isolated world — has chrome APIs

let storedProblem = null;

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.data?.source !== 'lc-helper') return;

  const { type, payload } = e.data;

  if (type === 'QUESTION_DATA') {
    storedProblem = payload;
    chrome.runtime.sendMessage({ type: 'PROBLEM_OPENED', ...payload });
  } else if (type === 'SUBMISSION_DETAILS') {
    if (payload.statusMsg !== 'Accepted') return;
    chrome.runtime.sendMessage({
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
