// Runs in MAIN world — NO chrome APIs

const _fetch = window.fetch.bind(window);

window.fetch = async function (...args) {
  const [url, options] = args;
  const response = await _fetch(...args);

  if (typeof url === 'string' && url.includes('/graphql')) {
    try {
      const body = options?.body ? JSON.parse(options.body) : null;
      const opName = body?.operationName;
      const clone = response.clone();
      const json = await clone.json();

      if (opName === 'questionData' && json?.data?.question) {
        const q = json.data.question;
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
