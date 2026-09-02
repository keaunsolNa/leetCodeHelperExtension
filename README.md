# LeetCode Helper Chrome Extension

LeetCode 문제를 풀면 자동으로 GitHub에 push하는 Chrome 익스텐션입니다.

- 문제 페이지 접속 시 → `UnSolved/` 에 문제 파일 생성
- 정답 제출(Accepted) 시 → `Solved/` 에 풀이 + Groq AI 한국어 코드 리뷰 저장

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
├── UnSolved/
│   └── 0001-two-sum/
│       ├── problem.md
│       └── Solution.java
└── Solved/
    └── 0001-two-sum/
        ├── problem.md
        ├── Solution.java
        └── analysis.md
```

## 동작 흐름

```
문제 페이지 접속
  → UnSolved/{id}-{slug}/ 에 problem.md + Solution.{ext} 생성 (이미 있으면 스킵)

정답 제출 (Accepted)
  → Groq llama-3.3-70b 로 한국어 코드 리뷰 생성
  → Solved/{id}-{slug}/ 에 3개 파일 생성
  → UnSolved/{id}-{slug}/ 삭제
```

## 기술 스택

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES2022+, 번들러 없음)
- GitHub Contents API REST v3
- Groq API (`llama-3.3-70b-versatile`)

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
