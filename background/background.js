// background/background.js

const DIFFICULTY_FOLDER = { Easy: 'Easy', Medium: 'Med', Hard: 'Hard' };

// Groq 모델은 주기적으로 폐기(decommission)된다. 폐기된 ID로 호출하면 404가 나고
// 리뷰가 통째로 실패하므로, 여기 한 곳만 바꾸면 되도록 상수로 분리한다.
// llama-3.3-70b-versatile은 2026-08-16 종료되어 gpt-oss-120b로 교체했다.
const GROQ_MODEL = 'openai/gpt-oss-120b';

// 분석 실패로 남은 analysis.md를 다음 제출 때 알아보고 재생성하기 위한 표식.
const ANALYSIS_FAILED_MARKER = '분석 실패';

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
  return `# Analysis

| Item | Value |
|------|-------|
| Submitted | ${now} |
| Language | ${lang} |
| Runtime | ${runtime} (Beats ${rtPct}%) |
| Memory | ${memory} (Beats ${memPct}%) |

## Submission

[View on LeetCode](https://leetcode.com/problems/${slug}/submissions/)

## Code Review

${review}
`;
}

async function callGroqApi({ slug, difficulty, tags, lang, code }, groqApiKey) {
  const prompt = [
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

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      // gpt-oss 계열은 reasoning 토큰도 출력 한도를 소모하므로 넉넉히 잡는다.
      max_completion_tokens: 4096,
      reasoning_effort: 'low',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status} (${GROQ_MODEL}): ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`Groq ${GROQ_MODEL}: 빈 응답`);
  return content;
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
    sendStatusUpdate('error', '설정 미완료 — 옵션 페이지에서 GitHub 정보를 입력하세요.');
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
  // 이전 분석이 실패로 남아 있으면 코드가 그대로여도 다시 시도한다.
  const analysisFailedBefore =
    !!analysisExists?.content &&
    decodeGithubContent(analysisExists.content).includes(ANALYSIS_FAILED_MARKER);

  let analysisWritten = false;
  let analysisError = null;
  if (solutionWritten || !analysisExists || analysisFailedBefore) {
    let review;
    if (groqApiKey) {
      try {
        review = await callGroqApi(msg, groqApiKey);
      } catch (err) {
        analysisError = err.message;
      }
    } else {
      analysisError = 'Groq API Key 미설정 — 옵션 페이지에서 입력하세요.';
    }
    // 실패 원인을 파일에 남겨야 다음에 왜 비었는지 추적할 수 있다.
    if (!review) {
      console.error('[lc-helper] Groq 분석 실패:', analysisError);
      review = `> ⚠️ 코드 ${ANALYSIS_FAILED_MARKER}: ${analysisError}`;
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
  sendStatusUpdate(
    'success',
    wrote
      ? `Solved push 완료: ${diffFolder}/${dir}`
      : `변경 없음 — 건너뜀: ${diffFolder}/${dir}`
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(msg).catch((err) => sendStatusUpdate('error', err.message));
  }
  sendResponse({ ok: true });
  return true;
});
