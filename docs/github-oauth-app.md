# GitHub OAuth App 등록

옵션 페이지의 **"GitHub 계정으로 연결"** 버튼은 GitHub OAuth **Device Flow**를 씁니다.
Device Flow는 client secret이 필요 없어서 서버 없이 확장 프로그램만으로 인증이 끝납니다.
사용자는 토큰을 직접 발급받는 대신 8자리 코드만 입력하면 됩니다.

동작하려면 **Client ID 하나**를 채워 넣어야 합니다. 아래 순서대로 하면 5분이면 됩니다.

## 1. OAuth App 만들기

<https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**

| 입력란 | 값 |
|---|---|
| Application name | `LeetCode Helper` |
| Homepage URL | `https://github.com/keaunsolNa/leetCodeHelperExtension` |
| Application description | 사용자가 승인 화면에서 보게 될 설명 (선택) |
| Authorization callback URL | `https://github.com/keaunsolNa/leetCodeHelperExtension` |

> callback URL은 입력이 **필수**지만 Device Flow에서는 실제로 쓰이지 않습니다.
> 아무 유효한 URL이나 넣으면 되고, 레포 주소를 넣어두는 게 무난합니다.

**Register application** 클릭.

## 2. Device Flow 켜기 ⚠️

등록 직후 앱 설정 화면에서 **Enable Device Flow** 체크박스를 켜고 **Update application**.

**이걸 빼먹으면** 연결 시도할 때 확장이 이렇게 알려 줍니다:

> OAuth App에 Device Flow가 켜져 있지 않습니다.

## 3. Client ID 붙여넣기

앱 설정 화면 상단의 **Client ID**(`Ov23li...` 형태)를 복사해서
`options/github-auth.js` 맨 위 상수에 넣습니다.

```js
const GITHUB_CLIENT_ID = 'Ov23li여기에붙여넣기';
```

Client ID는 **공개되어도 되는 값**입니다. 확장 패키지 안에 그대로 들어가고,
저장소에 커밋해도 됩니다. 반면 **Client secret은 만들 필요도, 넣을 이유도 없습니다.**
Device Flow는 secret을 쓰지 않으며, 확장에 넣으면 누구나 꺼내 볼 수 있습니다.

## 4. 아이콘 (선택)

앱 설정 화면에서 로고를 올릴 수 있습니다. `icons/icon512.png`를 쓰면
사용자 승인 화면에 확장 아이콘이 그대로 보여서 신뢰도가 올라갑니다.

## 권한 범위

옵션 페이지의 **"비공개 저장소에도 저장"** 체크박스가 요청 범위를 결정합니다.

| 체크 | scope | 범위 |
|---|---|---|
| 해제 (기본) | `public_repo` | 공개 저장소만 |
| 체크 | `repo` | 비공개 저장소 포함 |

기본값을 좁게 잡은 이유는, 대부분의 사용자가 알고리즘 풀이를 공개 저장소에 올리는데
`repo`는 **모든 비공개 저장소**에 대한 읽기·쓰기를 함께 가져가기 때문입니다.

## Client ID를 안 넣으면?

옵션 페이지가 OAuth 버튼을 감추고 **"토큰 직접 입력 (고급)"** 칸을 펼쳐 줍니다.
포크해서 쓰는 사람도 Personal Access Token으로 그대로 쓸 수 있습니다.
