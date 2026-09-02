# Chrome 웹 스토어 제출 가이드

이 문서는 LeetCode Helper를 Chrome 웹 스토어에 올릴 때 심사 폼에 그대로
복사·붙여넣기 할 수 있는 문구와 체크리스트를 담고 있다.

---

## 0. 사전 준비

| 할 일 | 비고 |
|---|---|
| 개발자 계정 등록 | <https://chrome.google.com/webstore/devconsole> · 최초 1회 **$5** |
| 개인정보처리방침 URL 확보 | `PRIVACY.md`를 push 후 아래 URL 사용 |
| 스크린샷 1장 이상 | 1280×800 (또는 640×400) PNG/JPEG |
| 배포용 zip 생성 | `powershell -File tools/package.ps1` |

**개인정보처리방침 URL (그대로 사용 가능):**

```
https://github.com/keaunsolNa/leetCodeHelperExtension/blob/master/PRIVACY.md
```

> GitHub Pages를 쓰고 싶다면 레포 Settings → Pages → Source: `master` / `/ (root)`
> 로 켠 뒤 `https://keaunsolna.github.io/leetCodeHelperExtension/PRIVACY.html` 사용.
> 굳이 켤 필요는 없고, 위 blob URL로도 심사에 통과한다.

---

## 1. 스토어 등록정보 (Store listing)

**이름**
```
LeetCode Helper
```

**요약 / Short description** (132자 이내)
```
LeetCode 문제 풀이를 본인 GitHub 레포에 자동으로 저장하고 AI 코드 리뷰를 함께 남깁니다.
```

**상세 설명 / Detailed description**
```
LeetCode 문제를 풀면 풀이 코드를 자동으로 본인 GitHub 저장소에 커밋해 주는 확장 프로그램입니다.

■ 동작 방식
· 문제 페이지에 접속하면 UnSolved/{번호}-{슬러그}/ 에 문제 설명(problem.md)과 빈 풀이 파일을 만듭니다.
· 정답(Accepted) 판정을 받으면 Solved/{번호}-{슬러그}/ 로 옮기고, 제출한 코드와 AI가 작성한 한국어 코드 리뷰(analysis.md)를 함께 저장합니다.
· 코드 리뷰에는 시간/공간 복잡도, 풀이 접근법, 잘된 점, 개선 사항이 정리됩니다.

■ 사용 전 설정
확장 프로그램 아이콘 우클릭 → 옵션에서 아래 값을 입력하세요.
· GitHub Personal Access Token (repo 또는 contents:write 권한)
· GitHub 사용자명 / 저장할 레포지토리 이름 / 레포 내 기본 경로
· Groq API Key (console.groq.com 에서 무료 발급)

■ 개인정보
별도의 서버를 운영하지 않습니다. 입력한 토큰과 API 키는 브라우저에만 저장되며,
GitHub API와 Groq API 외에는 어디로도 전송되지 않습니다. 개발자는 어떤 데이터도 수집하지 않습니다.
소스코드 전체가 공개되어 있습니다: https://github.com/keaunsolNa/leetCodeHelperExtension

■ 지원 언어
Java, Python, JavaScript, TypeScript, C, C++, C#, Go, Ruby, Swift, Kotlin, Scala, Rust, PHP
```

**카테고리**: `개발자 도구 (Developer Tools)`
**언어**: `한국어`

**스크린샷 소재 (권장 3장)**
1. LeetCode 문제 페이지 + 확장 팝업에 성공 상태가 뜬 화면
2. 옵션 설정 화면
3. GitHub 레포의 `Solved/0001-two-sum/` 폴더 (problem.md / Solution.java / analysis.md)

> 1280×800으로 캡처하기 어렵다면 640×400도 허용된다. 캡처 시 **GitHub 토큰과
> Groq 키가 화면에 노출되지 않도록** 반드시 가리고 찍을 것.

---

## 2. 개인정보 보호 탭 (Privacy practices)

**단일 목적 (Single purpose)**
```
Saves the user's own LeetCode submissions, along with an AI-generated code review, into a GitHub repository that the user owns and configures.
```

**권한 사용 사유 (Permission justification)**

`storage`
```
Stores the user-provided GitHub Personal Access Token, GitHub username, target repository name, base path, and Groq API key so the user does not have to re-enter them on every submission. Also caches the status of the last operation so the popup can display it. No other data is stored.
```

`https://leetcode.com/*` (host permission + content script)
```
The content script runs only on LeetCode problem pages. It reads the problem metadata (title, number, difficulty, description) and the code of the user's own accepted submission, which are the exact contents that need to be written to the user's GitHub repository. Nothing is read from any other site.
```

`https://api.github.com/*`
```
Required to create and update the solution files in the GitHub repository that the user configured, using the user's own Personal Access Token via the GitHub Contents API.
```

`https://api.groq.com/*`
```
Required to generate the Korean-language code review that is saved as analysis.md. The problem description and the user's submitted code are sent to the Groq API using the user's own API key. If the user leaves the API key empty, no request is made.
```

**원격 코드 사용 (Remote code)**: `아니요, 원격 코드를 사용하지 않습니다`
> 번들러 없는 순수 정적 JS만 포함하며 `eval`, `new Function`, 외부 스크립트 로드가 없다.

**데이터 사용 공개 (Data usage) — 체크할 항목**

- [x] **인증 정보 (Authentication information)** — GitHub PAT, Groq API Key
- [x] **웹사이트 콘텐츠 (Website content)** — LeetCode 문제 설명, 제출한 풀이 코드
- [ ] 개인 식별 정보 — GitHub 사용자명을 식별자로 볼 여지가 있어 보수적으로 체크해도 무방
- [ ] 그 외 항목(위치, 건강, 금융, 개인 통신, 활동 로그)은 모두 해당 없음

> 구글 기준에서 "수집"은 **기기 밖으로 전송**하는 것을 뜻한다. 개발자 서버는 없지만
> GitHub·Groq으로 전송하므로 위 두 항목은 반드시 체크해야 한다.

**인증 체크박스 3개 — 모두 체크**
- 제3자에게 데이터를 판매하지 않음
- 단일 목적과 무관한 용도로 사용/전송하지 않음
- 신용도 평가·대출 목적으로 사용/전송하지 않음

---

## 3. 배포 (Distribution)

| 항목 | 선택 |
|---|---|
| 공개 상태 | **미등록(Unlisted)** — 검색에 노출되지 않고 링크로만 설치 |
| 지역 | 전체 또는 대한민국 |
| 가격 | 무료 |

Unlisted로 올려도 자동 업데이트와 `chrome.storage.sync` 동기화는 동일하게 동작한다.
새 PC에서는 설치 링크 하나만 열면 되고, 같은 구글 계정이면 옵션 값까지 그대로 따라온다.

---

## 4. 업데이트할 때

1. `manifest.json`의 `version`을 올린다 (예: `1.0.0` → `1.0.1`). 스토어는 같은 버전 번호의 재업로드를 거부한다.
2. `powershell -File tools/package.ps1`
3. 개발자 대시보드 → 해당 항목 → 패키지 → 새 zip 업로드 → 검토 제출

심사는 보통 수 시간 ~ 며칠 걸린다.
