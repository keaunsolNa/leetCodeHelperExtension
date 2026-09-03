# LeetCode Helper Chrome Extension

LeetCode 문제를 풀면 자동으로 GitHub에 push하는 Chrome 익스텐션입니다.

정답(Accepted) 판정을 받는 순간, 난이도별로 정리된 폴더에 문제 설명 · 제출한 풀이 ·
AI 한국어 코드 리뷰 3개 파일을 커밋합니다.

## 설치

### 1) Chrome 웹 스토어 (권장)

<https://chromewebstore.google.com/detail/enciibhcobdplbeinadchlpfacnebfnh>

> 심사 통과 후 활성화됩니다.

링크로 설치하면 자동 업데이트가 되고, 같은 구글 계정으로 로그인한 다른 PC에서는
설정값(`chrome.storage.sync`)까지 그대로 따라오므로 추가 설정이 필요 없다.

### 2) 개발자 모드로 직접 로드

1. `chrome://extensions` → 개발자 모드 ON
2. **Load unpacked** → 이 프로젝트 폴더 선택
3. 익스텐션 아이콘 우클릭 → **옵션** → 아래 설정값 입력 후 저장

## 설정

익스텐션 아이콘 우클릭 → **옵션**.

**1. GitHub 연결** — **"GitHub 계정으로 연결"** 버튼을 누르면 8자리 코드가 나옵니다.
GitHub 창에 입력하고 승인하면 끝이고, 토큰을 직접 만들 필요가 없습니다.
기본은 공개 저장소만 접근하는 `public_repo` 권한이며, 비공개 저장소에 저장하려면
체크박스를 켜서 `repo`로 넓힙니다.

> 직접 만든 Personal Access Token을 쓰고 싶다면 **"토큰 직접 입력 (고급)"**을 펼치세요.
> Fine-grained는 `Contents: Read and write`, classic은 `repo`(또는 `public_repo`) 권한이 필요합니다.

**2. 저장 위치**

| 항목 | 설명 |
|------|------|
| GitHub 사용자명 / 조직명 | 연결하면 자동으로 채워집니다 |
| 저장소 이름 | 알고리즘 저장용 레포 (미리 만들어 두세요) |
| 기본 경로 | 레포 내 경로 (예: `leetcode`). 비워도 됩니다 |

**3. AI 코드 리뷰 — 선택**

[console.groq.com](https://console.groq.com)에서 무료로 발급받은 Groq API Key를 넣으면
`analysis.md`에 복잡도 분석과 개선 제안이 함께 저장됩니다. **비워두면 리뷰 없이**
문제 설명과 풀이 파일만 커밋합니다.

> 포크해서 직접 배포하려면 OAuth Client ID를 채워야 합니다 —
> [`docs/github-oauth-app.md`](docs/github-oauth-app.md) 참고.

## GitHub 레포 구조

```
{basePath}/
└── Solved/
    ├── Easy/
    │   └── 0001-two-sum/
    │       ├── problem.md      # 문제 설명 (front matter + 본문)
    │       ├── Solution.java   # 제출한 풀이
    │       └── analysis.md     # 실행시간/메모리 + AI 코드 리뷰
    ├── Med/
    └── Hard/
```

난이도 폴더명은 `Easy` / `Med` / `Hard` 이며 `background/background.js`의
`DIFFICULTY_FOLDER` 상수에서 바꿀 수 있습니다.

## 동작 흐름

```
LeetCode 문제 페이지 진입
  → main-world.js 가 GraphQL 응답을 가로채 문제 메타데이터를 캐시

정답 제출 (Accepted 판정)
  → Groq 로 한국어 코드 리뷰 생성
  → Solved/{난이도}/{id}-{slug}/ 에 problem.md · Solution.{ext} · analysis.md 커밋
```

- 내용이 기존 파일과 같으면 PUT을 건너뛰어 **빈 커밋을 만들지 않습니다.**
- `analysis.md`는 매번 내용이 달라지므로, 풀이가 실제로 바뀌었거나 이전 분석이
  실패했을 때만 재생성합니다.
- Groq API Key가 비어 있으면 리뷰 없이 나머지 2개 파일만 커밋합니다.

## 기술 스택

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES2022+, 번들러 없음)
- GitHub Contents API REST v3
- Groq API — 모델이 폐기되면 `/models`로 살아 있는 모델을 찾아 자동 전환
- GitHub OAuth Device Flow (client secret 불필요 → 서버 없음)

## 개인정보

개발자가 운영하는 서버는 없다. 자세한 내용은 [`PRIVACY.md`](PRIVACY.md) 참고.
