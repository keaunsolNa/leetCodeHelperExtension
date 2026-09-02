# Privacy Policy — LeetCode Helper

**Last updated: 2026-09-02**

LeetCode Helper ("the Extension") is an open-source Chrome extension that saves your
own LeetCode solutions into your own GitHub repository. Source code:
<https://github.com/keaunsolNa/leetCodeHelperExtension>

## 1. We operate no server

The developer of the Extension operates **no backend server, no database, and no
analytics**. No data is ever transmitted to the developer. All processing happens
locally in your browser, and all network requests go directly from your browser to
services you configured yourself.

## 2. What the Extension handles

| Data | Where it is stored / sent | Purpose |
|---|---|---|
| GitHub Personal Access Token | `chrome.storage.sync` (your browser, synced by Chrome to your Google account) | Authenticate to the GitHub API on your behalf |
| GitHub username, repository name, base path | `chrome.storage.sync` | Determine where files are written |
| Groq API key | `chrome.storage.sync` | Authenticate to the Groq API on your behalf |
| LeetCode problem title, number, slug, difficulty, description | Sent to `api.github.com` and `api.groq.com` | Generate `problem.md` and the code review |
| Your submitted solution code, language, runtime/memory stats | Sent to `api.github.com` and `api.groq.com` | Save `Solution.{ext}` and generate `analysis.md` |
| Last operation status (success/error message) | `chrome.storage.local` (your browser only) | Show status in the popup |

## 3. Third parties

The Extension sends data only to these two endpoints, using credentials you supply:

- **GitHub API** (`https://api.github.com`) — writes files to the repository you
  configured. Governed by [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
- **Groq API** (`https://api.groq.com`) — receives the problem description and your
  solution code to generate a Korean-language code review. Governed by
  [Groq's Privacy Policy](https://groq.com/privacy-policy/).

If you do not want your code sent to Groq, leave the Groq API key field empty; no
request to Groq will be made.

## 4. Credential handling

Your GitHub token and Groq API key are stored using the Chrome extension storage API
and are readable only by this Extension. Because `chrome.storage.sync` is used, Chrome
replicates them to your other devices signed in to the same Google account. They are
never sent anywhere except as `Authorization` headers to the two APIs listed above.

You can delete them at any time by clearing the fields on the Options page, or by
removing the Extension.

## 5. What we do not do

- We do not sell or transfer your data to third parties.
- We do not use your data for purposes unrelated to the Extension's single purpose.
- We do not use your data to determine creditworthiness or for lending purposes.
- We do not collect analytics, telemetry, or advertising identifiers.

## 6. Contact

Questions or issues: <https://github.com/keaunsolNa/leetCodeHelperExtension/issues>

---

# 개인정보처리방침 — LeetCode Helper

**최종 수정일: 2026-09-02**

LeetCode Helper(이하 "본 확장 프로그램")는 사용자가 푼 LeetCode 풀이를 사용자 본인의
GitHub 저장소에 저장하는 오픈소스 크롬 확장 프로그램입니다.

## 1. 개발자는 서버를 운영하지 않습니다

본 확장 프로그램은 **백엔드 서버, 데이터베이스, 분석 도구를 일절 사용하지 않습니다.**
개발자에게 전송되는 데이터는 없으며, 모든 처리는 사용자의 브라우저 안에서 이루어지고
모든 네트워크 요청은 사용자가 직접 설정한 서비스로만 전송됩니다.

## 2. 취급하는 데이터

| 데이터 | 저장/전송 위치 | 목적 |
|---|---|---|
| GitHub Personal Access Token | `chrome.storage.sync` (브라우저 내부, 구글 계정으로 동기화) | GitHub API 인증 |
| GitHub 사용자명, 레포지토리명, 기본 경로 | `chrome.storage.sync` | 파일을 저장할 위치 결정 |
| Groq API Key | `chrome.storage.sync` | Groq API 인증 |
| LeetCode 문제 제목/번호/슬러그/난이도/설명 | `api.github.com`, `api.groq.com` 로 전송 | `problem.md` 생성 및 코드 리뷰 작성 |
| 제출한 풀이 코드, 언어, 실행시간/메모리 | `api.github.com`, `api.groq.com` 로 전송 | `Solution.{ext}` 저장 및 `analysis.md` 생성 |
| 마지막 동작 상태 메시지 | `chrome.storage.local` (브라우저 내부에만 저장) | 팝업에 상태 표시 |

## 3. 제3자 제공

사용자가 입력한 자격증명을 사용하여 아래 두 곳으로만 데이터를 전송합니다.

- **GitHub API** — 사용자가 지정한 저장소에 파일을 기록합니다.
- **Groq API** — 한국어 코드 리뷰 생성을 위해 문제 설명과 풀이 코드를 전송합니다.

Groq API Key를 비워두면 Groq으로의 요청은 발생하지 않습니다.

## 4. 자격증명 처리

GitHub 토큰과 Groq API Key는 크롬 확장 저장소 API에 저장되며 본 확장 프로그램만
읽을 수 있습니다. `chrome.storage.sync`를 사용하므로 동일한 구글 계정으로 로그인한
다른 기기에도 크롬이 복제합니다. 위 두 API의 `Authorization` 헤더 외의 용도로는
어디에도 전송되지 않습니다.

옵션 페이지에서 값을 지우거나 확장 프로그램을 삭제하면 즉시 제거됩니다.

## 5. 하지 않는 것

- 데이터를 판매하거나 제3자에게 이전하지 않습니다.
- 단일 목적과 무관한 용도로 사용하지 않습니다.
- 신용도 평가나 대출 목적으로 사용하지 않습니다.
- 분석/텔레메트리/광고 식별자를 수집하지 않습니다.

## 6. 문의

<https://github.com/keaunsolNa/leetCodeHelperExtension/issues>
