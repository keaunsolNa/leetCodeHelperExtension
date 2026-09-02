// options/github-auth.js
//
// GitHub OAuth Device Flow.
//
// Device Flow는 client secret 없이 동작하므로 서버를 두지 않는 확장 프로그램에서도
// 안전하게 쓸 수 있다. 사용자는 토큰을 직접 발급받는 대신 8자리 코드만 입력한다.
// (웹 애플리케이션 플로우는 토큰 교환에 secret이 필요해 확장에는 쓸 수 없다.)
//
// 폴링이 수 분까지 이어질 수 있어 서비스 워커가 아니라 옵션 페이지에서 실행한다.
// MV3 서비스 워커는 유휴 30초면 종료되지만 옵션 페이지는 사용자가 닫을 때까지 살아있다.

// OAuth App의 Client ID. 공개되어도 무방한 값이다.
// 등록 방법은 docs/github-oauth-app.md 참고.
const GITHUB_CLIENT_ID = 'Ov23liPmhbepTEy7qp01';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// Client ID가 채워지지 않은 배포본에서는 OAuth 버튼을 감추고 토큰 직접 입력으로
// 폴백한다. 포크해서 쓰는 사람이 아무것도 못 하게 되는 상황을 막는다.
export const OAUTH_ENABLED = !GITHUB_CLIENT_ID.startsWith('YOUR_');

// repo는 비공개 저장소까지 포함해 권한 범위가 넓다. 대부분은 공개 저장소에
// 기록하므로 기본값은 public_repo로 두고, 필요한 사람만 넓힌다.
export const SCOPE_PUBLIC = 'public_repo';
export const SCOPE_PRIVATE = 'repo';

const ERROR_MESSAGES = {
  authorization_pending: '아직 승인되지 않았습니다.',
  slow_down: '요청이 너무 잦습니다.',
  expired_token: '코드가 만료되었습니다. 다시 시도해 주세요.',
  access_denied: 'GitHub에서 승인이 거부되었습니다.',
  incorrect_device_code: '코드가 올바르지 않습니다. 다시 시도해 주세요.',
  device_flow_disabled:
    'OAuth App에 Device Flow가 켜져 있지 않습니다. GitHub의 OAuth App 설정에서 "Enable Device Flow"를 체크해 주세요.',
  unsupported_grant_type:
    'OAuth App에 Device Flow가 켜져 있지 않습니다. GitHub의 OAuth App 설정에서 "Enable Device Flow"를 체크해 주세요.',
};

function describeError(data) {
  const known = ERROR_MESSAGES[data.error];
  if (known) return known;
  return data.error_description || data.error || '알 수 없는 오류';
}

async function postJson(url, body) {
  // 확장 프로그램은 host_permissions에 선언한 호스트에 대해 CORS 제약 없이 요청할 수
  // 있다. github.com/login/* 이 manifest에 들어 있어야 이 요청이 성공한다.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`GitHub 응답을 해석할 수 없습니다 (HTTP ${res.status})`);
  return data;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('사용자가 취소했습니다.'));
      },
      { once: true }
    );
  });
}

/** 8자리 사용자 코드와 인증 URL을 받아온다. */
export async function requestDeviceCode(scope) {
  const data = await postJson(DEVICE_CODE_URL, { client_id: GITHUB_CLIENT_ID, scope });
  if (data.error) throw new Error(describeError(data));
  return data; // { device_code, user_code, verification_uri, expires_in, interval }
}

/**
 * 사용자가 브라우저에서 승인을 마칠 때까지 폴링한다.
 * GitHub은 알려준 interval보다 빨리 요청하면 slow_down으로 응답하고 새 간격을 준다.
 */
export async function pollForToken(device, { signal, onWait } = {}) {
  let waitMs = (device.interval || 5) * 1000;
  const deadline = Date.now() + (device.expires_in || 900) * 1000;

  while (Date.now() < deadline) {
    onWait?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    await sleep(waitMs, signal);

    const data = await postJson(TOKEN_URL, {
      client_id: GITHUB_CLIENT_ID,
      device_code: device.device_code,
      grant_type: GRANT_TYPE,
    });

    if (data.access_token) return data.access_token;

    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      // GitHub이 새 간격을 알려주면 그대로 따르고, 없으면 5초 물러선다.
      waitMs = ((data.interval || device.interval || 5) + 5) * 1000;
      continue;
    }
    throw new Error(describeError(data));
  }
  throw new Error('인증 시간이 만료되었습니다. 다시 시도해 주세요.');
}

/** 발급받은 토큰으로 계정명을 조회한다. 저장 위치 자동 입력에 쓴다. */
export async function fetchLogin(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`계정 정보를 가져오지 못했습니다 (HTTP ${res.status})`);
  const user = await res.json();
  return user.login;
}
