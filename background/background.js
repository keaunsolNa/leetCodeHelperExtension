// background/background.js

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

async function createFile(owner, repo, filePath, content, message, token) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  await githubRequest(
    'PUT',
    `/repos/${owner}/${repo}/contents/${filePath}`,
    { message, content: encoded },
    token
  );
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
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '코드 분석 실패';
}

// ── Message Handlers ─────────────────────────────────────────────────────────

function sendStatusUpdate(status, message) {
  const payload = { type: 'STATUS_UPDATE', status, message, timestamp: Date.now() };
  chrome.storage.local.set({ lastStatus: payload });
  chrome.runtime.sendMessage(payload).catch(() => {});
}

async function handleProblemOpened(msg) {
  const { githubToken, githubOwner, githubRepo, basePath } = await getSettings();
  if (!githubToken || !githubOwner || !githubRepo) {
    sendStatusUpdate('error', '설정 미완료 — 옵션 페이지에서 GitHub 정보를 입력하세요.');
    return;
  }

  const dir = dirName(msg.id, msg.slug);
  const base = basePath ? `${basePath}/` : '';
  const problemPath = `${base}UnSolved/${dir}/problem.md`;

  const existing = await getFileInfo(githubOwner, githubRepo, problemPath, githubToken);
  if (existing) {
    sendStatusUpdate('skip', `이미 존재: UnSolved/${dir}`);
    return;
  }

  const ext = getExt(msg.lang);
  await createFile(
    githubOwner, githubRepo, problemPath,
    buildProblemMd(msg),
    `docs: add problem ${dir}`,
    githubToken
  );
  await createFile(
    githubOwner, githubRepo, `${base}UnSolved/${dir}/Solution.${ext}`,
    msg.starterCode || '',
    `feat: add starter solution ${dir}`,
    githubToken
  );

  sendStatusUpdate('success', `UnSolved 생성: ${dir}`);
}

async function handleSubmissionAccepted(msg) {
  const { githubToken, githubOwner, githubRepo, basePath, groqApiKey } = await getSettings();
  if (!githubToken || !githubOwner || !githubRepo) {
    sendStatusUpdate('error', '설정 미완료 — 옵션 페이지에서 GitHub 정보를 입력하세요.');
    return;
  }

  const dir = dirName(msg.id, msg.slug);
  const base = basePath ? `${basePath}/` : '';
  const analysisPath = `${base}Solved/${dir}/analysis.md`;

  const existing = await getFileInfo(githubOwner, githubRepo, analysisPath, githubToken);
  if (existing) {
    sendStatusUpdate('skip', `이미 Solved 존재: ${dir}`);
    return;
  }

  let review = '코드 분석 실패';
  if (groqApiKey) {
    try {
      review = await callGroqApi(msg, groqApiKey);
    } catch (_) {}
  }

  const ext = getExt(msg.lang);
  await createFile(
    githubOwner, githubRepo, `${base}Solved/${dir}/problem.md`,
    buildProblemMd(msg), `docs: solved problem ${dir}`, githubToken
  );
  await createFile(
    githubOwner, githubRepo, `${base}Solved/${dir}/Solution.${ext}`,
    buildSolutionContent(msg), `feat: solved ${dir}`, githubToken
  );
  await createFile(
    githubOwner, githubRepo, `${base}Solved/${dir}/analysis.md`,
    buildAnalysisMd(msg, review), `docs: add analysis ${dir}`, githubToken
  );

  for (const filename of [`problem.md`, `Solution.${ext}`]) {
    const info = await getFileInfo(
      githubOwner, githubRepo, `${base}UnSolved/${dir}/${filename}`, githubToken
    );
    if (info?.sha) {
      await deleteFile(
        githubOwner, githubRepo, `${base}UnSolved/${dir}/${filename}`,
        info.sha, `cleanup: remove unsolved ${dir}`, githubToken
      ).catch(() => {});
    }
  }

  sendStatusUpdate('success', `Solved push 완료: ${dir}`);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PROBLEM_OPENED') {
    handleProblemOpened(msg).catch((err) => sendStatusUpdate('error', err.message));
  } else if (msg.type === 'SUBMISSION_ACCEPTED') {
    handleSubmissionAccepted(msg).catch((err) => sendStatusUpdate('error', err.message));
  }
  sendResponse({ ok: true });
  return true;
});
