# LeetCode Helper Chrome Extension

LeetCode 문제를 풀면 자동으로 GitHub에 push하는 Chrome 익스텐션입니다.

- 문제 페이지 접속 시 → `UnSolved/` 에 문제 파일 생성
- 정답 제출(Accepted) 시 → `Solved/` 에 풀이 + Groq AI 한국어 코드 리뷰 저장

## 설치

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
