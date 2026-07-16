# Android APK 이미지 복원과 구버전 프로젝트 호환 설계

## 상태

- 대상 앱 버전은 `0.1.2`다.
- 사용자는 `resources.arsc`의 실제 파일 참조를 우선하는 APK 복원 방식과 구버전 프로젝트 이미지 마이그레이션을 승인했다.
- 이 문서 검토가 끝나면 구현 계획을 작성하고 실패 테스트부터 추가한다.

## 확인한 현상

- 현재 0.1.1 코드로 macOS에서 만든 표준 APK는 다시 불러올 수 있다. 진단용 APK에서 Android 이미지 37개와 색상 44개를 복원했다.
- APK 불러오기는 현재 소스 경로에서 `-v4` 또는 `-v13`을 붙인 한 가지 컴파일 경로를 추측한다. ZIP 엔트리의 구분자, 대소문자, 루트 폴더, 다른 qualifier를 처리하지 않는다.
- `resources.arsc` 파서는 색상과 문자열을 읽지만 drawable과 mipmap의 실제 파일 참조를 호출자에게 반환하지 않는다.
- 이미지가 0개여도 컴파일된 테마 색상을 하나 이상 찾으면 APK 불러오기가 성공한다. 이 조건에서 사용자는 색상만 남고 이미지가 사라진 프로젝트를 받는다.
- 구버전 프로젝트는 인라인 이미지, 중첩 `assets`, 공용 `resources`, 현재 `platformResources` 순서로 저장 구조가 바뀌었다. 각 구조가 모두 `schemaVersion: 1`을 사용하므로 버전 번호로 형식을 구분할 수 없다.
- 현재 parser는 빈 플랫폼 버킷을 만들지만 구버전 이미지 저장소를 옮기지 않는다. 설정 화면과 내보내기는 `platformResources`만 읽기 때문에 구버전 아이콘이 샘플 아이콘으로 바뀌거나 빈 상태로 보인다.
- Windows에서 만든 문제 APK를 받지 못했으므로 Windows AAPT2가 어떤 경로를 기록했는지는 확인하지 못했다. 수정은 운영체제를 추측하지 않고 APK 안의 실제 참조를 읽는다.

## 목표

- AAPT2가 선택한 qualifier와 ZIP 경로 표기가 달라도 APK 이미지를 현재 리소스 슬롯으로 복원한다.
- 색상만 읽고 이미지 0개를 정상 불러오기로 처리하지 않는다.
- 앱이 내보낸 APK에 사용자가 지정한 Android 이미지 리소스가 들어갔는지 저장 전에 검사한다.
- 구버전 v1 프로젝트의 아이콘, 탭, 프로필, 배경, 잠금 이미지와 말풍선을 현재 플랫폼 버킷으로 옮긴다.
- 현재 iOS와 Android 플랫폼 버킷이 가진 값을 유지한다.

## 제외 범위

- 0.1.2에서 프로젝트 스키마 번호를 올리지 않는다. 형식 구분에는 객체 모양을 사용한다.
- 공용 `resources`를 renderer와 exporter의 상시 fallback으로 복구하지 않는다. 그렇게 하면 현재 플랫폼 분리 규칙을 다시 깨뜨린다.
- 서로 다른 네 개의 구버전 메인 화면 배경을 하나의 `main.background`로 임의 병합하지 않는다.
- 문제 APK가 없는 상태에서 Windows AAPT2 자체의 결함을 원인으로 단정하지 않는다.

## APK 리소스 복원

### 컴파일 리소스 메타데이터

`AndroidCompiledMetadata`에 직렬화 가능한 `resourceFiles`를 추가한다. 키는 `drawable/<resource-name>` 또는 `mipmap/<resource-name>`이며 값은 `resources.arsc`가 가리키는 APK 내부 경로 배열이다.

`readResourceTable`은 각 타입과 이름에 이미 모든 후보 값을 모은다. 파서는 drawable과 mipmap 후보 중 `res/`로 시작하는 문자열만 골라 `resourceFiles`에 넣는다. 같은 이름의 밀도별 파일은 모두 유지한다. 색상과 제목 선택에 쓰는 기존 기본 qualifier 우선순위는 바꾸지 않는다.

Importer는 각 `KAKAO_RESOURCE_SLOTS` Android binding의 파일명에서 리소스 타입과 이름을 계산한다. `.9.png`는 확장자와 `.9`을 제거해 Android 리소스 이름과 맞춘다. 보낸 말풍선과 받은 말풍선도 같은 계산과 조회 함수를 사용하며 리소스 ID만 다르게 전달한다.

리소스 타입, 이름, semantic qualifier를 계산하는 함수는 별도 `androidArchiveResources` 모듈에 둔다. AAPT2가 붙인 `-v4`, `-v13` 같은 SDK suffix는 semantic qualifier 비교에서 제외한다. Importer와 exporter 검증이 이 함수를 함께 사용해 경로 해석 규칙이 갈라지지 않게 한다. 이 모듈은 ZIP 인덱스와 PNG 픽셀 지문도 제공하며 `themeImport`나 `androidStandaloneBuild`를 import하지 않는다.

리소스 테이블이 adaptive icon XML과 밀도별 PNG를 같은 이름으로 제공할 수 있다. 실제 진단 APK의 `drawable/theme_background_image`와 `mipmap/ic_launcher`에서 이 조합을 확인했다. 이미지 슬롯은 실제 참조 중 `.png`와 `.9.png`만 후보로 사용하고 binding의 밀도와 방향 순서에 맞는 PNG를 고른다. XML wrapper는 이미지로 해석하지 않는다. 첫 PNG가 없거나 손상됐으면 다음 PNG 후보를 검사하고 모든 후보를 소진한 뒤 해당 슬롯을 실패로 판정한다.

### 안전한 ZIP 인덱스

Importer는 한 번 만든 ZIP 인덱스를 모든 슬롯이 공유한다. 인덱스 생성 코드는 다음 규칙을 적용한다.

- 역슬래시를 슬래시로 바꾸고 선행 `./`와 중복 슬래시를 제거한다.
- 절대 경로와 `..` 세그먼트를 거부한다.
- 원본 경로와 소문자 lookup 키를 함께 보관한다.
- 정규화한 키가 둘 이상의 엔트리를 가리키면 임의 파일을 고르지 않고 충돌로 처리한다.
- Android 소스 ZIP은 `src/main` 앞의 공통 루트 폴더 한 개를 허용한다. APK는 루트의 `res` 경로만 받는다.

APK 슬롯은 다음 순서로 파일을 찾는다.

1. `resources.arsc`가 같은 타입과 이름에 기록한 실제 경로
2. 현재 binding에서 만든 정확한 컴파일 경로와 qualifier 변형
3. 같은 리소스 타입과 이름으로 제한한 정규화 경로

소스 ZIP 슬롯은 binding의 `src/main` 경로를 먼저 찾고 공통 루트 폴더를 적용한다. 전체 ZIP에서 파일명만 같은 이미지를 고르는 전역 fallback은 넣지 않는다. 다른 슬롯의 이미지를 잘못 연결할 위험이 있기 때문이다.

같은 리소스에 여러 밀도가 있으면 기존 `orderedFiles`의 선호 qualifier와 가장 가까운 실제 참조를 고른다. 현재 편집 미리보기는 xxhdpi를 우선하고, splash처럼 방향별 파일이 있는 슬롯은 세로 binding 순서를 유지한다.

### 복원 결과와 오류 처리

`importMappedImages`는 복원한 리소스 ID와 실패한 실제 참조를 반환한다. PNG 해석, 9-patch guide 추출, `sourceScale` 계산은 선택한 실제 경로를 사용한다.

컴파일 APK에서 카카오톡 색상을 읽었어도 복원 이미지가 0개면 불러오기를 중단한다. 오류 문구는 색상만 읽었고 이미지 리소스를 복원하지 못했다는 사실과 원본 APK 확인이 필요하다는 내용을 담는다. 리소스 테이블이 현재 지원 슬롯을 가리키지만 모든 PNG 후보를 소진한 뒤에도 ZIP 엔트리를 찾지 못하거나 이미지를 읽지 못한 경우에는 해당 리소스 이름을 포함해 중단한다.

Android 소스 ZIP은 기존의 색상 전용 허용 동작을 유지한다. APK와 소스 ZIP의 검증 조건을 분리해 기존 개발용 소스 가져오기를 막지 않는다.

Electron의 `importTheme`은 `.apk`를 `importAndroidThemeArchive`로, `.zip`을 `importAndroidSourceZip`으로 나눠 호출한다. 함수 인자가 비어 있는지로 파일 종류를 추측하지 않는다. APK용 함수만 이미지 0개 검사를 적용한다.

## Android 내보내기 검증

`replaceMappedAndroidImages`는 컴파일 대상 파일마다 다음 검증 레코드를 반환한다.

```text
resourceId, sourcePath, resourceType, resourceName,
expectedQualifier, ninePatch, pixelFingerprint, guides?
```

레코드는 `src/main/res`, `src/main/theme`, `src/main/theme-adv` 아래에서 실제로 쓴 파일만 포함한다. AAPT2가 컴파일하지 않는 `src/main/ic_launcher-web.png`는 파일 교체만 수행하고 검증 레코드에서는 제외한다. 같은 리소스 이름의 xxhdpi와 sw600dp 파일도 별도 레코드로 유지해 한 밀도 누락을 다른 밀도 파일이 가리지 못하게 한다. 컴파일 대상 binding에서 대상 파일과 `outputSize`가 모두 없어 이미지를 만들 수 없으면 건너뛰지 않고 오류를 낸다.

픽셀 지문은 준비를 마친 PNG의 너비, 높이와 디코드한 RGBA로 만든 SHA-256 값이다. 완전 투명 픽셀은 RGB를 0으로 정규화한다. 9-patch 소스는 1px marker 테두리를 제거한 내부 픽셀을 사용하고 컴파일 PNG는 `npTc` 바깥의 visible bitmap을 사용한다. 이 비교는 PNG 압축 방식이 달라도 같은 화면 픽셀을 같은 값으로 판단한다. 9-patch guide는 컴파일 전후 좌표를 픽셀로 환산해 각 경계가 1px 안에서 같은지 별도로 검사한다.

`buildStandaloneAndroidApk`는 검증 레코드 배열을 기대값으로 받는다. 임시 경로에 서명한 APK를 만든 뒤 `inspectCompiledAndroidApk`와 ZIP 인덱스를 사용해 다음 항목을 검사한다.

- 기대한 각 drawable 또는 mipmap 이름과 qualifier가 `resources.arsc`에 존재한다.
- 리소스 테이블이 가리키는 PNG 엔트리가 APK에 존재한다.
- APK PNG의 정규화한 픽셀 지문이 준비 단계의 지문과 같다.
- 9-patch의 stretch와 content guide가 컴파일 전 값과 1px 안에서 같다.

검사가 실패하면 사용자가 선택한 위치에 APK를 복사하지 않는다. 기존 패키지 이름, 버전, 제목, 모드, 색상, manifest, DEX와 V2 서명 검증도 유지한다.

`androidStandaloneBuild`는 `themeImport`를 import하지 않는다. `verify:android-runtime` 스크립트가 빌드 결과를 `importAndroidThemeArchive`로 다시 열어 기대한 `resourceId`를 복원하는지 검사한다. 이 경계는 build와 import 모듈 사이의 순환 의존성을 막는다.

macOS 개발 환경에서는 공용 TypeScript 경로와 macOS AAPT2 출력 APK를 실행 검증한다. Windows 런타임은 해시, 실행 파일 형식, 명령 계획과 패키지 포함 여부를 검사한다. 문제가 발생한 Windows APK를 받으면 회귀 fixture로 추가한다.

## 구버전 v1 프로젝트 정규화

`parseThemeProject`는 기본값을 넣기 전에 원본 객체에서 legacy 이미지 후보와 플랫폼 슬롯의 존재 상태를 읽어 둔다. 후보와 현재 플랫폼 값은 `fileName`과 `dataUrl`이 비어 있지 않은 문자열인 `ImageAsset`만 받는다. 잘못된 현재 asset 엔트리는 정규화한 플랫폼 버킷에서 빼서 fallback을 막거나 exporter로 전달되지 않게 한다. 탭 키는 과거 스키마가 지원한 `friends`, `chats`, `now`, `shopping`, `more`로 제한한다.

Parser는 `screens`, `chat`, 양쪽 플랫폼 버킷 등 현재 필수 구조를 복구한 뒤 `normalizeLegacyProjectImages`를 호출한다. 이 순서는 일부 필드가 빠진 v1 프로젝트의 인라인 이미지를 읽다가 중단되는 일을 막는다. 같은 입력을 두 번 정규화해도 결과가 바뀌지 않아야 한다.

값의 우선순위는 다음과 같다.

1. `platformResources.<platform>[id]`
2. 공용 `resources[id]`
3. 중첩 `assets` 값
4. 인라인 화면 또는 말풍선 이미지

공용 `resources[id]`는 현재 슬롯 상태에 따라 옮긴다.

| 현재 유효 플랫폼 값 | 정규화 동작 |
| --- | --- |
| 양쪽 모두 없음 | 출력 파일 binding이 있는 양쪽에 공용 값을 복제하고 `userSelected: true`를 기록한다. |
| 한쪽만 있고 기존 값이 누락 쪽에서 온 mirror임 | 공용 값을 누락 쪽의 native 값으로 복원하고 기존 mirror는 유지한다. |
| 한쪽만 있고 기존 값이 `userSelected`임 | 기존 편집을 유지하고 누락 쪽에는 공용 값을 `userSelected: true`로 복원한다. |
| 한쪽만 있고 그 값이 공용 값과 같음 | 기존 쪽을 source로 보고 누락 쪽 복제본에 `mirroredFromPlatform: <source>`를 기록한다. `userSelected`는 추가하지 않는다. |
| 한쪽만 있고 기존 값과 공용 값의 관계가 불명확함 | 자동 복제하지 않고 원본 필드를 보존한다. |
| 양쪽 모두 있음 | 아무 값도 바꾸지 않는다. |

한쪽 값에 여러 조건이 겹치면 표의 위쪽 규칙을 먼저 적용한다. 이 규칙은 flat `resources`만 있던 파일과 0.1.1이 빈 플랫폼 버킷을 붙여 다시 저장한 파일을 복구한다. 한쪽 플랫폼을 가진 import형 프로젝트는 출처 marker를 남겨 반대 플랫폼의 말풍선 크기를 변환하고 자동 복제를 명시적 사용자 편집으로 바꾸지 않는다.

중첩 `assets`와 인라인 이미지는 공용 값보다 후순위로 사용한다. 현재 값과 공용 값이 없는 슬롯에만 넣고, 출력 파일 binding이 있는 플랫폼에 `userSelected: true` 복제본을 만든다. 파일 목록이 빈 색상 전용 binding에는 이미지를 넣지 않는다.

중첩 `assets`는 다음처럼 옮긴다.

| 구버전 필드 | 현재 리소스 ID |
| --- | --- |
| `themeIcon` | `common.theme-icon` |
| `tabBar.background` | `main.tab.background` |
| `tabBar.icons.<tab>.normal` | `main.tab.<tab>.normal` |
| `tabBar.icons.<tab>.selected` | `main.tab.<tab>.selected` |
| `profile` | `main.profile.01` |
| `profileFull` | `main.profile.01.full` |
| `addFriendButton` | `main.add-friend.normal` |
| `splash` | `splash.image` |
| `passcode.bullets.normal[n]` | `passcode.bullet.<n+1>.normal` |
| `passcode.bullets.selected[n]` | `passcode.bullet.<n+1>.selected` |
| `passcode.keypadPressed` | `passcode.keypad.pressed` |

인라인 `chat.bubbles.<side>.<variant>.image`는 `chat.bubble.<side>.<sequence>.<state>`로 옮긴다. `normal`과 `pressed`는 첫 말풍선, `grouped`와 `groupedPressed`는 연속 말풍선에 대응한다. 각 플랫폼 binding이 지원하는 상태만 채운다. 보내기와 받기 모두 같은 변환 함수를 거친다.

인라인 배경은 의미가 직접 대응하고 상위 후보와 충돌하지 않는 항목만 옮긴다.

- `chatroom`은 `chat.background`로 옮긴다.
- `passcode`는 `passcode.background`로 옮긴다.
- `splash`는 중첩 `assets.splash`가 없을 때만 `splash.image`로 옮긴다.
- `friends`, `chats`, `now`, `more`가 같은 이미지 데이터를 가진 경우에만 `main.background`로 옮긴다.

과거 형식은 `assets.splash`와 `screens.splash.background.image`를 동시에 저장할 수 있었다. 두 값이 다르면 의미가 더 직접 대응하는 `assets.splash`를 사용하고 인라인 splash는 원본 필드에 보존한다. 메인 화면별 이미지가 서로 다를 때도 원래 인라인 필드를 보존한다. 0.1.2 exporter는 각 충돌을 하나의 현재 슬롯으로 표현할 수 없으므로 값을 임의 선택하지 않는다.

유효한 현재 플랫폼 데이터와 알 수 없는 구버전 필드는 삭제하지 않는다. `resources`도 호환 자료로 남기되 renderer와 exporter는 정규화한 플랫폼 버킷만 읽는다.

## 설정 화면 방어

`ThemeSettings`의 이미지 읽기는 `platformResources?.[platform] ?? {}`를 사용한다. 쓰기는 먼저 `{ ios: {}, android: {} }` 형태를 만들고 기존 양쪽 버킷을 병합한 뒤 현재 플랫폼 값을 갱신한다. 정상 프로젝트 열기 경로에서는 parser가 버킷을 보장하지만, 테스트나 향후 호출자가 정규화 전 객체를 전달해도 현재 화면과 다음 플랫폼 전환이 중단되지 않게 한다. 화면 방어 코드는 parser 마이그레이션을 대신하지 않는다.

## 테스트 전략

구현 전에 다음 실패 테스트를 추가한다.

- 컴파일 fixture의 `resources.arsc`에서 drawable과 mipmap 실제 경로를 추출한다.
- `-v4`, `-v13`, 다른 qualifier, 역슬래시, 대소문자 변형을 가진 APK에서 올바른 슬롯 이미지를 복원한다.
- 다른 리소스 타입이나 같은 basename을 가진 파일을 잘못 연결하지 않는다.
- 컴파일 색상은 있지만 이미지가 0개인 APK를 명시적 오류로 거부한다.
- 현재 표준 APK에서 이미지 37개와 색상 44개를 다시 복원한다.
- 내보내기 기대 이미지의 밀도별 참조나 ZIP 엔트리가 빠지면 최종 APK 쓰기 전에 실패한다.
- APK에 같은 리소스 키의 다른 픽셀이 들어가거나 9-patch guide가 1px 허용 범위를 벗어나면 실패한다.
- `assets.themeIcon`, 공용 `resources`, 탭, 프로필, 잠금 이미지와 양쪽 말풍선을 현재 플랫폼 버킷으로 옮긴다.
- flat-only 파일과 빈 플랫폼 버킷으로 다시 저장한 0.1.1 파일을 양쪽 플랫폼에서 복원한다.
- 한쪽 플랫폼만 있는 mixed v1 import에 source marker를 남기고 현재 사용자 편집을 덮어쓰지 않는다.
- 현재 플랫폼 값이 구버전 값보다 우선하고 정규화를 두 번 실행해도 결과가 같다.
- 서로 다른 구버전 메인 배경과 충돌한 splash 이미지를 하나로 합치지 않는다.
- 잘못된 asset placeholder와 알 수 없는 tab 키를 exporter 슬롯으로 만들지 않는다.
- 구버전 프로젝트를 연 설정 탭이 저장된 아이콘을 표시하고 raw 객체 수정 뒤 양쪽 플랫폼 버킷을 유지한다.

집중 테스트 뒤 전체 검증을 실행한다.

```text
npm test -- src/domain/theme.test.ts src/io/themeImport.test.ts src/io/androidStandaloneBuild.test.ts src/components/ThemeSettings.test.tsx
npm test
npm run typecheck
npm run audit:theme
npm run verify:android-runtime
npm run verify
npm run package:mac
npm run package:win
```

## 버전과 산출물

구현과 검증을 마친 뒤 `package.json`과 `package-lock.json`을 `0.1.2`로 함께 올린다. macOS와 Windows 설치 파일을 만들고 `release/`, `dist/`, `dist-electron/`은 커밋하지 않는다. 한 번의 0.1.2 push에 코드, 테스트, 버전 변경을 묶는다.

## 완료 조건

- qualifier와 경로 표기가 다른 유효 APK가 색상과 매핑 가능한 이미지를 함께 복원한다.
- 이미지 0개 APK 불러오기가 성공으로 끝나지 않는다.
- 0.1.2가 만든 APK를 다시 열었을 때 내보낸 이미지 리소스 ID가 남는다.
- 구버전 v1 프로젝트의 저장 아이콘과 결정 가능한 이미지가 설정, 미리보기, 내보내기에 나타난다.
- 현재 플랫폼별 이미지는 마이그레이션 전후에 같은 값을 유지한다.
- 전체 테스트, Android runtime 검증, macOS와 Windows 패키징이 통과한다.
