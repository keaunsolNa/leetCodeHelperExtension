# LeetCode Helper Chrome Extension — Design Spec

**Date:** 2026-06-15  
**Status:** Approved

---

## Overview

기존 Spring Boot 로컬 서버 기반의 LeetCode Helper를 크롬 익스텐션으로 재구성한다.  
LeetCode 페이지에서 정답 제출이 확인되면 자동으로 GitHub에 push하는 것이 핵심 목표다.  
로컬 서버 없이 순수 크롬 익스텐션 + GitHub API + Groq API만으로 완결된다.

---

## Architecture

### 컴포넌트 구성

```
manifest.json (Manifest V3)
├── content/
│   └── content.js         ← leetcode.com/problems/* 에 주입
├── background/
│   └── background.js      ← GitHub API + Groq API 호출
├── options/
│   ├── options.html       ← 설정 페이지
│   └── options.js
└── popup/
    ├── popup.html         ← 툴바 아이콘 팝업 (상태 표시)
    └── popup.js
```

### 각 컴포넌트 역할

| 컴포넌트 | 역할 |
|---|---|
| **content.js** | `window.fetch` 후킹으로 LeetCode GraphQL 응답 감지, DOM에서 문제 정보 추출, background로 메시지 전송 |
| **background.js** | GitHub API / Groq API 호출, 파일 생성·삭제·중복 체크 처리 |
| **options.html/js** | 사용자 설정 입력 및 저장 |
| **popup.html/js** | 마지막 동작 상태 표시 (성공/실패/스킵) |
| **chrome.storage.sync** | 설정값 영속화 |

---

## Data Flow

### ① UnSolved 흐름 (문제 페이지 접속 시)

```
사용자가 leetcode.com/problems/{slug}/ 접속
  → content.js: DOM에서 문제 정보 추출
      (id, slug, title, difficulty, tags, lang, starterCode)
  → background로 PROBLEM_OPENED 메시지 전송
  → GitHub API 중복 체크
      GET /repos/{owner}/{repo}/contents/{basePath}/UnSolved/{id}-{slug}/problem.md
      → 404: problem.md + Solution.{ext} 생성
      → 200: 스킵 (이미 존재)
```

### ② Solved 흐름 (Accepted 감지 시)

```
사용자가 Submit 클릭 → LeetCode GraphQL 폴링 시작
  → content.js: window.fetch 후킹으로 submissionDetails 응답 감지
  → statusMsg === "Accepted" 확인
  → runtime, memory, runtimePercentile, memoryPercentile, code, lang 추출
  → background로 SUBMISSION_ACCEPTED 메시지 전송
  → 중복 체크: GET {basePath}/Solved/{id}-{slug}/analysis.md
      → 200: 전체 스킵
      → 404: 계속 진행
  → Groq API 호출 → 한국어 코드 리뷰 생성
  → GitHub API: Solved/{id}-{slug}/ 에 3개 파일 생성
      - problem.md
      - Solution.{ext}
      - analysis.md
  → GitHub API: UnSolved/{id}-{slug}/ 파일 삭제 (존재하는 경우)
```

### 메시지 타입

| 타입 | 발신 | 수신 | 데이터 |
|---|---|---|---|
| `PROBLEM_OPENED` | content.js | background.js | id, slug, title, difficulty, tags, lang, starterCode |
| `SUBMISSION_ACCEPTED` | content.js | background.js | id, slug, title, difficulty, tags, lang, code, runtime, runtimePercentile, memory, memoryPercentile |
| `STATUS_UPDATE` | background.js | popup.js | status, message, timestamp |

---

## Directory Structure (GitHub Repo)

사용자가 설정한 `basePath` 하위에 생성된다.

```
{basePath}/
├── UnSolved/
│   └── {4-digit-id}-{slug}/
│       ├── problem.md
│       └── Solution.{ext}
└── Solved/
    └── {4-digit-id}-{slug}/
        ├── problem.md
        ├── Solution.{ext}
        └── analysis.md
```

---

## File Formats

### problem.md

```markdown
---
id: 1
slug: two-sum
title: Two Sum
difficulty: Easy
tags: Array, Hash Table
date: 2026-06-15
lang: java
---

# 1. Two Sum

**Difficulty:** Easy | **Tags:** Array, Hash Table

## Description

{문제 설명 HTML → Markdown 변환}
```

### Solution.{ext}

LeetCode에서 제공하는 starterCode 그대로 저장.  
언어별 확장자 매핑: java→.java, python3→.py, javascript→.js, typescript→.ts, cpp→.cpp 등.

### analysis.md

```markdown
# Analysis

| Item | Value |
|------|-------|
| Submitted | 2026-06-15 14:32:00 |
| Language | java |
| Runtime | 1 ms (Beats 98.5%) |
| Memory | 41 MB (Beats 72.3%) |

## Submission

[View on LeetCode](https://leetcode.com/problems/two-sum/submissions/)

## Code Review

{Groq llama-3.3-70b 생성 한국어 리뷰}
```

Code Review 섹션은 Groq API(`llama-3.3-70b-versatile`)로 생성하며 한국어로 작성된다.  
리뷰 항목: 시간 복잡도, 공간 복잡도, 풀이 접근법, 잘된 점, 개선 사항.

---

## User Settings

`chrome.storage.sync`에 저장되는 설정값:

| 키 | 설명 | 예시 |
|---|---|---|
| `githubToken` | Personal Access Token (repo 스코프 필요) | `ghp_xxx...` |
| `githubOwner` | GitHub 사용자명 | `keaunsol` |
| `githubRepo` | 레포 이름 | `algorithm-study` |
| `basePath` | 레포 내 기본 경로 | `leetcode` |
| `groqApiKey` | Groq API 키 | `gsk_xxx...` |

---

## Error Handling

| 상황 | 처리 방식 |
|---|---|
| 설정값 미입력 | popup에 경고 표시, 동작 중단 |
| GitHub API 실패 | popup에 실패 알림, 재시도 없음 |
| Groq API 실패 | Code Review 섹션에 "코드 분석 실패" 텍스트 대체 후 나머지 파일 정상 push |
| 이미 Solved에 존재 | 전체 스킵 (덮어쓰기 없음) |
| UnSolved 삭제 실패 | 무시하고 계속 (Solved push는 완료 상태) |

---

## Tech Stack

| 항목 | 선택 |
|---|---|
| 익스텐션 규격 | Manifest V3 |
| 언어 | JavaScript (ES2022+) |
| 번들러 | 없음 (vanilla JS, 단순 구조) |
| GitHub 연동 | GitHub Contents API (REST v3) |
| AI 코드 리뷰 | Groq API (`llama-3.3-70b-versatile`) |
| 스토리지 | chrome.storage.sync |

---

## Out of Scope

- 로컬 파일시스템 접근 (Git CLI 실행 없음)
- 자동 문제 스케줄링 (fetch 스케줄러 없음)
- LeetCode에서 직접 제출 기능 (익스텐션이 제출하지 않고 감지만 함)
- 기존 Spring Boot 프로젝트와의 연동
