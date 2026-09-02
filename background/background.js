// background/background.js

const DIFFICULTY_FOLDER = { Easy: 'Easy', Medium: 'Med', Hard: 'Hard' };

// Groq 모델은 주기적으로 폐기(decommission)된다. 하나를 하드코딩해 두면 그 모델이
// 죽는 날 모든 사용자가 동시에 고장나고, 새 버전을 심사받아 배포할 때까지 복구할
// 방법이 없다. 그래서 선호 순서만 정해 두고 실제로 쓸 모델은 런타임에 확정한다.
// 목록이 전부 폐기돼도 /models 로 살아 있는 모델을 찾아내 이어서 동작한다.
const GROQ_MODEL_PREFERENCES = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

// 채팅 완성에 쓸 수 없는 모델을 자동 선택에서 걸러낸다.
const GROQ_NON_CHAT = /whisper|tts|guard|embed|vision|prompt-?guard/i;

// Groq 무료 티어는 분당 토큰(TPM) 한도가 8,000이고, 요청 시점에 프롬프트 +
// max_completion_tokens 전체를 미리 예약해 차감한다. 리뷰 본문은 길어야 1.5k
// 토큰이라 2,048이면 충분하고, 한도를 덜 잡아야 연속 제출이 429를 덜 맞는다.
const GROQ_MAX_COMPLETION_TOKENS = 2048;

// 429는 잠깐 기다리면 풀리므로 재시도한다. MV3 서비스 워커는 유휴 30초면
// 종료될 수 있어 대기는 그보다 짧게 자른다.
const GROQ_MAX_RETRIES = 3;
const GROQ_MAX_WAIT_MS = 25000;

// 분석 실패로 남은 analysis.md를 다음 제출 때 알아보고 재생성하기 위한 표식.
const ANALYSIS_FAILED_MARKER = '분석 실패';

// analysis.md에 리뷰가 들어갔는지 판별하는 표식. Groq 키를 나중에 추가한 사용자의
// 기존 파일을 다시 생성해 주기 위해 쓴다.
const REVIEW_HEADING = '## Code Review';

const LANG_EXT = {
  java: 'java',
  python3: 'py',
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  cpp: 'cpp',
  c: 'c',
  golang: 'go',
  ruby: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  scala: 'scala',
  rust: 'rs',
  csharp: 'cs',
  php: 'php',
};

function padId(id) {
  return String(id).padStart(4, '0');
}

function dirName(id, slug) {
  return `${padId(id)}-${slug}`;
}

function getExt(lang) {
  return LANG_EXT[lang] || lang;
}

function getSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(
      ['githubToken', 'githubOwner', 'githubRepo', 'basePath', 'groqApiKey'],
      resolve
    )
  );
}

async function githubRequest(method, path, body, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub ${res.status}: ${err.message || path}`);
  }
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

async function getFileInfo(owner, repo, filePath, token) {
  const { status, data } = await githubRequest(
    'GET',
    `/repos/${owner}/${repo}/contents/${filePath}`,
    null,
    token
  );
  return status === 200 ? data : null;
}

// GitHub Contents API가 돌려주는 base64(60자마다 개행 포함)를 UTF-8 문자열로 복원.
// 쓰기 시 btoa(unescape(encodeURIComponent(x)))의 역연산.
function decodeGithubContent(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

// 내용이 기존 파일과 동일하면 PUT을 생략해 빈 커밋을 만들지 않는다.
// 실제로 커밋을 만든 경우 true, 변경 없어 건너뛴 경우 false를 반환한다.
async function createFile(owner, repo, filePath, content, message, token) {
  const existing = await getFileInfo(owner, repo, filePath, token);
  if (existing?.content && decodeGithubContent(existing.content) === content) {
    return false;
  }
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (existing?.sha) body.sha = existing.sha;
  await githubRequest('PUT', `/repos/${owner}/${repo}/contents/${filePath}`, body, token);
  return true;
}

async function deleteFile(owner, repo, filePath, sha, message, token) {
  await githubRequest(
    'DELETE',
    `/repos/${owner}/${repo}/contents/${filePath}`,
    { message, sha },
    token
  );
}

// ── File Content Builders ────────────────────────────────────────────────────

function htmlToText(html) {
  return html
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) =>
      '\n```\n' + c.replace(/<[^>]+>/g, '') + '\n```\n'
    )
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function buildProblemMd({ id, slug, title, difficulty, tags, content, lang }) {
  const desc = content ? htmlToText(content) : '';
  return `---
id: ${id}
slug: ${slug}
title: ${title}
difficulty: ${difficulty}
tags: ${tags}
date: ${todayString()}
lang: ${lang}
---

# ${id}. ${title}

**Difficulty:** ${difficulty} | **Tags:** ${tags}

## Description

${desc}
`;
}

function buildSolutionContent({ code, starterCode }) {
  return code || starterCode || '';
}

function buildAnalysisMd(
  { slug, lang, runtime, runtimePercentile, memory, memoryPercentile },
  review
) {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const rtPct = runtimePercentile ? Number(runtimePercentile).toFixed(1) : '0.0';
  const memPct = memoryPercentile ? Number(memoryPercentile).toFixed(1) : '0.0';
  const doc = `# Analysis

| Item | Value |
|------|-------|
| Submitted | ${now} |
| Language | ${lang} |
| Runtime | ${runtime} (Beats ${rtPct}%) |
| Memory | ${memory} (Beats ${memPct}%) |

## Submission

[View on LeetCode](https://leetcode.com/problems/${slug}/submissions/)
`;

  // Groq 키가 없으면 리뷰 섹션을 아예 만들지 않는다. 빈 제목만 남겨두면
  // 나중에 키를 넣었을 때 채워야 할 파일인지 구분할 수 없다.
  if (!review) return doc;
  return `${doc}
${REVIEW_HEADING}

${review}
`;
}

function buildReviewPrompt({ slug, difficulty, tags, lang, code }) {
  return [
    'You are an expert software engineer reviewing a LeetCode solution.',
    'IMPORTANT: You MUST write the entire review in Korean (한국어).',
    '',
    `Problem: ${slug}`,
    `Difficulty: ${difficulty}`,
    `Tags: ${tags}`,
    `Language: ${lang}`,
    '',
    `\`\`\`${lang}`,
    code,
    '```',
    '',
    'Please write a concise code review in Korean covering:',
    '1. **시간 복잡도** — Big-O 표기와 설명',
    '2. **공간 복잡도** — Big-O 표기와 설명',
    '3. **풀이 접근법** — 사용된 알고리즘/패턴 간단 설명',
    '4. **잘된 점** — 코드에서 잘 구현된 부분',
    '5. **개선 사항** — 최적화 가능한 부분이나 대안적 접근법 (있는 경우)',
  ].join('\n');
}

// 폐기된 모델로 호출하면 Groq은 404 또는 본문에 decommissioned/does not exist를
// 담아 돌려준다. 이 경우에만 다른 모델로 갈아타야 하고, 401(키 오류) 같은 건
// 갈아타도 소용없다.
function isModelUnavailable(status, detail) {
  return status === 404 || /decommission|model_not_found|does not exist/i.test(detail);
}

/** 지금 쓸 모델. 한 번 확정하면 캐시해 두고 매번 /models를 부르지 않는다. */
async function resolveGroqModel() {
  const { groqModel } = await chrome.storage.local.get('groqModel');
  return groqModel || GROQ_MODEL_PREFERENCES[0];
}

/** 살아 있는 모델 목록을 받아 선호 순서대로 고른다. */
async function discoverGroqModel(apiKey, failedModel) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq 모델 목록 조회 실패 (HTTP ${res.status})`);

  const available = ((await res.json()).data || [])
    .map((m) => m.id)
    .filter((id) => id && id !== failedModel && !GROQ_NON_CHAT.test(id));

  const preferred = GROQ_MODEL_PREFERENCES.find((id) => available.includes(id));
  const picked = preferred || available[0];
  if (!picked) throw new Error('사용 가능한 Groq 모델을 찾지 못했습니다.');
  return picked;
}

async function requestReview(prompt, model, apiKey) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    // gpt-oss 계열은 reasoning 토큰도 출력 한도를 소모하므로 여유를 둔다.
    max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
  };
  // reasoning_effort는 gpt-oss 계열 전용이라 다른 모델에 보내면 400이 난다.
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';

  const request = {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  let lastError;
  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', request);

    if (res.ok) {
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error(`Groq ${model}: 빈 응답`);
      return content;
    }

    const detail = await res.text().catch(() => '');
    lastError = new Error(`Groq ${res.status} (${model}): ${detail.slice(0, 300)}`);
    lastError.modelUnavailable = isModelUnavailable(res.status, detail);

    // 429 외의 오류(401 키 문제, 404 모델 폐기 등)는 기다려도 풀리지 않는다.
    if (res.status !== 429 || attempt === GROQ_MAX_RETRIES) throw lastError;

    const waitMs = groqRetryDelayMs(res, detail, attempt);
    console.warn(`[lc-helper] Groq 429 — ${waitMs}ms 후 재시도 (${attempt + 1}/${GROQ_MAX_RETRIES})`);
    await sleep(waitMs);
  }
  throw lastError;
}

async function callGroqApi(msg, apiKey) {
  const prompt = buildReviewPrompt(msg);
  const model = await resolveGroqModel();

  try {
    return await requestReview(prompt, model, apiKey);
  } catch (err) {
    if (!err.modelUnavailable) throw err;

    // 쓰던 모델이 폐기됐다. 살아 있는 모델로 갈아타고 결과를 캐시해 두면
    // 다음 제출부터는 이 왕복이 없다.
    const next = await discoverGroqModel(apiKey, model);
    console.warn(`[lc-helper] ${model} 사용 불가 → ${next} 로 전환`);
    await chrome.storage.local.set({ groqModel: next });
    return await requestReview(prompt, next, apiKey);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Groq는 retry-after 헤더로, 없으면 에러 메시지의 "try again in 3.105s"로
// 대기 시간을 알려준다. 둘 다 없을 때만 지수 백오프로 물러선다.
function groqRetryDelayMs(res, detail, attempt) {
  const header = Number(res.headers.get('retry-after'));
  const fromBody = detail.match(/try again in ([\d.]+)s/i);
  const seconds = header > 0 ? header : fromBody ? Number(fromBody[1]) : 2 ** attempt;
  // 알려준 시각 직후에 다시 쏘면 또 걸리므로 1초 여유를 둔다.
  return Math.min((seconds + 1) * 1000, GROQ_MAX_WAIT_MS);
}

// ── Message Handlers ─────────────────────────────────────────────────────────

function sendStatusUpdate(status, message) {
  const payload = { type: 'STATUS_UPDATE', status, message, timestamp: Date.now() };
  chrome.storage.local.set({ lastStatus: payload });
  chrome.runtime.sendMessage(payload).catch(() => {});
}

async function handleSubmissionAccepted(msg) {
  const { githubToken, githubOwner, githubRepo, basePath, groqApiKey } = await getSettings();
  if (!githubToken || !githubOwner || !githubRepo) {
    sendStatusUpdate('error', '설정 미완료 — 옵션 페이지에서 GitHub 연결과 저장소를 설정하세요.');
    return;
  }

  const dir = dirName(msg.id, msg.slug);
  const diffFolder = DIFFICULTY_FOLDER[msg.difficulty] || 'Easy';
  const base = basePath ? `${basePath}/` : '';
  const solvedBase = `${base}Solved/${diffFolder}/${dir}`;

  const ext = getExt(msg.lang);
  const problemWritten = await createFile(
    githubOwner, githubRepo, `${solvedBase}/problem.md`,
    buildProblemMd(msg), `docs: solved problem ${dir}`, githubToken
  );
  const solutionWritten = await createFile(
    githubOwner, githubRepo, `${solvedBase}/Solution.${ext}`,
    buildSolutionContent(msg), `feat: solved ${dir}`, githubToken
  );

  // analysis.md는 제출 타임스탬프와 LLM 리뷰(비결정적)를 담아 매 제출마다 내용이
  // 달라진다. 따라서 무조건 재생성하면 동일 재제출에도 끝없이 커밋이 쌓인다.
  // 풀이가 실제로 바뀌었을 때(또는 분석 파일이 아직 없을 때)만 재생성·커밋한다.
  const analysisPath = `${solvedBase}/analysis.md`;
  const analysisExists = await getFileInfo(githubOwner, githubRepo, analysisPath, githubToken);
  const previousAnalysis = analysisExists?.content
    ? decodeGithubContent(analysisExists.content)
    : null;
  // 이전 분석이 실패로 남아 있으면 코드가 그대로여도 다시 시도한다.
  const analysisFailedBefore =
    !!previousAnalysis && previousAnalysis.includes(ANALYSIS_FAILED_MARKER);
  // 리뷰 없이 저장해 둔 파일이 있는데 이제 키가 생겼다면 이번에 채워 준다.
  const reviewNowPossible =
    !!groqApiKey && !!previousAnalysis && !previousAnalysis.includes(REVIEW_HEADING);

  let analysisWritten = false;
  let analysisError = null;
  if (solutionWritten || !analysisExists || analysisFailedBefore || reviewNowPossible) {
    // Groq 키는 선택 사항이다. 없으면 리뷰만 빠지고 나머지는 정상 동작한다.
    let review = null;
    if (groqApiKey) {
      try {
        review = await callGroqApi(msg, groqApiKey);
      } catch (err) {
        analysisError = err.message;
        console.error('[lc-helper] Groq 분석 실패:', analysisError);
        // 실패 원인을 파일에 남겨야 다음에 왜 비었는지 추적할 수 있다.
        review = `> ⚠️ 코드 ${ANALYSIS_FAILED_MARKER}: ${analysisError}`;
      }
    }
    analysisWritten = await createFile(
      githubOwner, githubRepo, analysisPath,
      buildAnalysisMd(msg, review), `docs: add analysis ${dir}`, githubToken
    );
  }

  const wrote = problemWritten || solutionWritten || analysisWritten;
  if (analysisError) {
    sendStatusUpdate('error', `분석 실패 (파일은 푸시됨): ${analysisError}`);
    return;
  }
  if (!wrote) {
    sendStatusUpdate('skip', `변경 없음 — 건너뜀: ${diffFolder}/${dir}`);
    return;
  }
  sendStatusUpdate(
    'success',
    groqApiKey
      ? `push 완료: ${diffFolder}/${dir}`
      : `push 완료 (AI 리뷰 없음): ${diffFolder}/${dir}`
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(msg).catch((err) => sendStatusUpdate('error', err.message));
  }
  sendResponse({ ok: true });
  return true;
});
