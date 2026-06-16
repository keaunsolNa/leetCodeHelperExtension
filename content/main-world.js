// Runs in MAIN world — NO chrome APIs

let questionSent = false;

// Primary: read problem data from __NEXT_DATA__ (available at DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const queries = window.__NEXT_DATA__?.props?.pageProps?.dehydratedState?.queries;
    if (!queries) return;

    const q = queries.find((entry) => entry?.state?.data?.question?.titleSlug)
                     ?.state?.data?.question;
    if (!q) return;

    sendQuestionData(q);
  } catch (_) {}
});

// Submission detection via fetch hook
const _fetch = window.fetch.bind(window);

window.fetch = async function (...args) {
  const [url, options] = args;
  const response = await _fetch(...args);

  if (typeof url !== 'string') return response;

  try {
    const clone = response.clone();
    const json = await clone.json();

    if (url.includes('/graphql')) {
      // GraphQL: question data fallback
      if (!questionSent && json?.data?.question?.titleSlug) {
        sendQuestionData(json.data.question);
      }
      // GraphQL: submissionDetails (일부 환경에서 사용)
      else if (json?.data?.submissionDetails) {
        const sub = json.data.submissionDetails;
        if (sub.statusMsg === 'Accepted') {
          postSubmission({
            lang: sub.lang?.name || 'java',
            code: sub.code || readEditorCode(),
            runtimeDisplay: sub.runtimeDisplay || '',
            runtimePercentile: sub.runtimePercentile || 0,
            memoryDisplay: sub.memoryDisplay || '',
            memoryPercentile: sub.memoryPercentile || 0,
          });
        }
      }
    } else if (url.includes('/check') && json?.state === 'SUCCESS') {
      // REST 폴링: /submissions/detail/{id}/check/
      if (json.status_msg === 'Accepted') {
        postSubmission({
          lang: json.lang || 'java',
          code: readEditorCode(),
          runtimeDisplay: json.status_runtime || '',
          runtimePercentile: json.runtime_percentile || 0,
          memoryDisplay: json.status_memory || '',
          memoryPercentile: json.memory_percentile || 0,
        });
      }
    }
  } catch (_) {}

  return response;
};

function postSubmission(payload) {
  window.postMessage(
    { source: 'lc-helper', type: 'SUBMISSION_DETAILS', payload: { statusMsg: 'Accepted', ...payload } },
    '*'
  );
}

function readEditorCode() {
  try {
    const editors = window.monaco?.editor?.getEditors?.() || [];
    return editors[0]?.getValue?.() || '';
  } catch (_) {
    return '';
  }
}

function sendQuestionData(q) {
  questionSent = true;
  const langSlug = readLang();
  const snippet =
    (q.codeSnippets || []).find((s) => s.langSlug === langSlug) ||
    (q.codeSnippets || [])[0] ||
    {};
  window.postMessage(
    {
      source: 'lc-helper',
      type: 'QUESTION_DATA',
      payload: {
        id: String(q.questionFrontendId || q.questionId || '0').replace(/\D/g, ''),
        slug: q.titleSlug || '',
        title: q.title || '',
        difficulty: q.difficulty || '',
        tags: (q.topicTags || []).map((t) => t.name).join(', '),
        content: q.content || '',
        lang: snippet.langSlug || langSlug,
        starterCode: snippet.code || '',
      },
    },
    '*'
  );
}

function readLang() {
  try {
    return (
      localStorage.getItem('lc-lang') ||
      localStorage.getItem('global_lang') ||
      'java'
    );
  } catch (_) {
    return 'java';
  }
}
