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

// Fallback + submission detection via fetch hook
const _fetch = window.fetch.bind(window);

window.fetch = async function (...args) {
  const [url, options] = args;
  const response = await _fetch(...args);

  if (typeof url === 'string' && url.includes('/graphql')) {
    try {
      const clone = response.clone();
      const json = await clone.json();

      if (!questionSent && json?.data?.question?.titleSlug) {
        sendQuestionData(json.data.question);
      } else if (json?.data?.submissionDetails) {
        const sub = json.data.submissionDetails;
        window.postMessage(
          {
            source: 'lc-helper',
            type: 'SUBMISSION_DETAILS',
            payload: {
              statusMsg: sub.statusMsg || '',
              lang: sub.lang?.name || 'java',
              code: sub.code || '',
              runtimeDisplay: sub.runtimeDisplay || '',
              runtimePercentile: sub.runtimePercentile || 0,
              memoryDisplay: sub.memoryDisplay || '',
              memoryPercentile: sub.memoryPercentile || 0,
            },
          },
          '*'
        );
      }
    } catch (_) {}
  }

  return response;
};

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
