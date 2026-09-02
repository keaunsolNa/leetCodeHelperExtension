// options/options.js

import {
  OAUTH_ENABLED,
  SCOPE_PUBLIC,
  SCOPE_PRIVATE,
  requestDeviceCode,
  pollForToken,
  fetchLogin,
} from './github-auth.js';

const TEXT_FIELDS = ['githubToken', 'githubOwner', 'githubRepo', 'basePath', 'groqApiKey'];
// githubLogin은 OAuth로 연결한 계정명. 토큰의 출처를 구분해 UI를 그리는 데 쓴다.
const ALL_FIELDS = [...TEXT_FIELDS, 'githubLogin'];

const $ = (id) => document.getElementById(id);
const el = {};
let pollAbort = null;

document.addEventListener('DOMContentLoaded', init);

function init() {
  // githubLogin 은 저장만 하는 값이라 입력 요소가 없다. 요소는 TEXT_FIELDS 만.
  TEXT_FIELDS.forEach((id) => { el[id] = $(id); });
  [
    'authConnected', 'authDisconnected', 'authLogin', 'connectBtn', 'disconnectBtn',
    'includePrivate', 'oauthUnavailable', 'deviceBox', 'userCode', 'verifyBtn',
    'copyBtn', 'cancelBtn', 'pollStatus', 'patDetails', 'saveBtn', 'status',
  ].forEach((id) => { el[id] = $(id); });

  chrome.storage.sync.get(ALL_FIELDS, (settings) => {
    TEXT_FIELDS.forEach((key) => {
      if (settings[key]) el[key].value = settings[key];
    });
    renderAuth(settings);
  });

  el.saveBtn.addEventListener('click', save);
  el.connectBtn.addEventListener('click', connect);
  el.disconnectBtn.addEventListener('click', disconnect);
  el.cancelBtn.addEventListener('click', () => pollAbort?.abort());

  if (!OAUTH_ENABLED) {
    el.connectBtn.hidden = true;
    el.includePrivate.parentElement.hidden = true;
    el.oauthUnavailable.hidden = false;
    el.patDetails.open = true;
  }
}

// ── 화면 상태 ────────────────────────────────────────────────────────────────

function renderAuth({ githubToken, githubLogin }) {
  const connected = Boolean(githubToken && githubLogin);
  el.authConnected.hidden = !connected;
  el.authDisconnected.hidden = connected;
  if (connected) el.authLogin.textContent = githubLogin;
  // 토큰은 있지만 OAuth로 받은 게 아니면(직접 입력) 해당 칸을 펼쳐서 보여준다.
  if (githubToken && !githubLogin) el.patDetails.open = true;
}

function setStatus(message, kind = 'ok') {
  el.status.textContent = message;
  el.status.className = kind;
  if (kind === 'ok' && message) {
    setTimeout(() => {
      if (el.status.textContent === message) el.status.textContent = '';
    }, 3000);
  }
}

function showDeviceBox(show) {
  el.deviceBox.hidden = !show;
  el.connectBtn.disabled = show;
}

// ── OAuth Device Flow ───────────────────────────────────────────────────────

async function connect() {
  setStatus('');
  const scope = el.includePrivate.checked ? SCOPE_PRIVATE : SCOPE_PUBLIC;

  try {
    el.connectBtn.disabled = true;
    el.pollStatus.textContent = 'GitHub에 인증 코드를 요청하는 중...';
    const device = await requestDeviceCode(scope);

    el.userCode.textContent = device.user_code;
    showDeviceBox(true);

    // 매번 새 코드가 나오므로 리스너를 갈아끼운다.
    el.verifyBtn.onclick = () => window.open(device.verification_uri, '_blank', 'noopener');
    el.copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(device.user_code);
      el.copyBtn.textContent = '복사됨';
      setTimeout(() => { el.copyBtn.textContent = '코드 복사'; }, 1500);
    };

    // 인증 페이지를 바로 띄워 준다. 사용자는 코드만 붙여넣으면 된다.
    window.open(device.verification_uri, '_blank', 'noopener');

    pollAbort = new AbortController();
    const token = await pollForToken(device, {
      signal: pollAbort.signal,
      onWait: (secondsLeft) => {
        const m = Math.floor(secondsLeft / 60);
        const s = String(secondsLeft % 60).padStart(2, '0');
        el.pollStatus.textContent = `승인을 기다리는 중... (${m}:${s} 남음)`;
      },
    });

    el.pollStatus.textContent = '계정 정보를 확인하는 중...';
    const login = await fetchLogin(token);

    // 토큰은 즉시 저장한다. 사용자가 저장 버튼을 누르기 전에 창을 닫아도
    // 인증을 다시 하게 만들지 않기 위해서다.
    const patch = { githubToken: token, githubLogin: login };
    // 저장 위치를 아직 안 채웠다면 계정명을 기본값으로 넣어 준다.
    if (!el.githubOwner.value.trim()) {
      patch.githubOwner = login;
      el.githubOwner.value = login;
    }
    await chrome.storage.sync.set(patch);

    el.githubToken.value = token;
    showDeviceBox(false);
    el.pollStatus.textContent = '';
    renderAuth({ githubToken: token, githubLogin: login });
    setStatus(`${login} 계정으로 연결되었습니다.`);
  } catch (err) {
    showDeviceBox(false);
    el.pollStatus.textContent = '';
    setStatus(err.message, 'err');
  } finally {
    el.connectBtn.disabled = false;
    pollAbort = null;
  }
}

async function disconnect() {
  // 확장에 저장된 토큰만 지운다. GitHub 계정 쪽 인증은 사용자가 GitHub 설정에서
  // 직접 취소해야 한다는 점을 알려 준다.
  await chrome.storage.sync.remove(['githubToken', 'githubLogin']);
  el.githubToken.value = '';
  renderAuth({});
  setStatus('연결을 해제했습니다. GitHub 계정의 앱 권한은 GitHub 설정에서 직접 취소할 수 있습니다.');
}

// ── 저장 ────────────────────────────────────────────────────────────────────

function save() {
  const values = {};
  TEXT_FIELDS.forEach((key) => { values[key] = el[key].value.trim(); });

  if (!values.githubToken || !values.githubOwner || !values.githubRepo) {
    setStatus('GitHub 연결과 저장소 정보는 반드시 입력해야 합니다.', 'err');
    return;
  }

  chrome.storage.sync.get(['githubToken', 'githubLogin'], ({ githubToken, githubLogin }) => {
    // 토큰을 손으로 바꿔치웠다면 OAuth로 연결했다는 표시는 더 이상 맞지 않는다.
    values.githubLogin = values.githubToken === githubToken ? githubLogin || '' : '';
    chrome.storage.sync.set(values, () => {
      renderAuth(values);
      setStatus('설정이 저장되었습니다.');
    });
  });
}
