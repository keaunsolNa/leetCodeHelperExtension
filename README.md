# LeetCode Helper Chrome Extension

LeetCode 문제를 풀면 자동으로 GitHub에 push하는 Chrome 익스텐션입니다.

정답(Accepted) 판정을 받는 순간, 난이도별로 정리된 폴더에 문제 설명 · 제출한 풀이 ·
AI 한국어 코드 리뷰 3개 파일을 커밋합니다.

## 설치

### 1) Chrome 웹 스토어 (권장)

> 스토어 등록 후 아래 링크를 채워 넣을 것
> `https://chrome.google.com/webstore/detail/<EXTENSION_ID>`

링크로 설치하면 자동 업데이트가 되고, 같은 구글 계정으로 로그인한 다른 PC에서는
설정값(`chrome.storage.sync`)까지 그대로 따라오므로 추가 설정이 필요 없다.

### 2) 개발자 모드로 직접 로드

1. `chrome://extensions` → 개발자 모드 ON
2. **Load unpacked** → 이 프로젝트 폴더 선택
3. 익스텐션 아이콘 우클릭 → **옵션** → 아래 설정값 입력 후 저장

## 설정

| 항목 | 설명 |
|------|------|
| GitHub Token | Personal Access Token (repo 또는 contents:write 스코프) |
| GitHub Username | 본인 GitHub 계정명 |
| Repository Name | 알고리즘 저장용 레포 이름 |
| Base Path | 레포 내 기본 경로 (예: `leetcode`) |
| Groq API Key | [console.groq.com](https://console.groq.com) 에서 발급 |

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
- Groq API (`openai/gpt-oss-120b` — 모델 ID는 `GROQ_MODEL` 상수 한 곳에서 관리)

## 배포

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/package.ps1
```

`dist/leetcode-helper-v{version}.zip` 이 만들어진다. 스토어 심사 폼에 넣을 문구와
체크리스트는 [`docs/chrome-web-store.md`](docs/chrome-web-store.md) 참고.

버전을 올릴 때는 `manifest.json`의 `version`을 먼저 수정해야 한다. 스토어는 동일한
버전 번호의 재업로드를 거부한다.

## 개인정보

개발자가 운영하는 서버는 없다. 자세한 내용은 [`PRIVACY.md`](PRIVACY.md) 참고.
