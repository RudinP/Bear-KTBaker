# 카카오톡 공식 테마 리소스 감사

기준 자료:

- `카카오톡 사용자 테마 제작가이드_26.5.0_iOS.pdf` 23쪽
- `카카오톡 사용자 테마 제작가이드_26.5.0_Android.pdf` 20쪽
- `apeach-25.8.0.ktheme`
- `apeach-26.1.0-source.zip`
- `apeach-26.1.0-debug.apk`

## 패키지 동일성

프로그램의 내보내기 템플릿은 사용자가 제공한 공식 파일과 SHA-256이 같다.

- iOS: `92aeff947f4ed8504167dbfcb39848777f4136516db2c8bbeeb7a707fd928d3d`
- Android source: `02216fe6d7632ab897157df0b4748a6e7f46ca52b1550474f8d03408b84244d6`

## 이미지 대조 결과

| 플랫폼 | 공식 패키지 PNG | 현재 매핑 | 패키지 누락 |
|---|---:|---:|---:|
| iOS | 58 | 64 | 0 |
| Android | 78 | 83 | 0 |

매핑 수가 더 많은 이유는 26.5 PDF에는 있지만 이전 버전 샘플 파일에는 없는 선택 리소스도 새로 생성할 수 있게 등록했기 때문이다.

- iOS 가이드 선택 리소스: `maintabIcoPiccoma` 기본/선택 `@2x`, `@3x` 4개
- iOS 확장 기본 프로필: `profileImg02@3x.png`, `profileImg03@3x.png` 2개
- Android 가이드 선택 리소스: `theme_profile_02_image`, `theme_profile_03_image`, `theme_profile_01~03_image_full` 5개

최초 감사에서 실제로 빠져 있던 Android 파일은 `ic_launcher_background` 5개 밀도와 `ic_launcher-web.png` 1개였다. 이제 일반 앱 아이콘, 적응형 아이콘 전경, 적응형 아이콘 배경으로 분리 매핑된다.

### OS별 샘플 이미지 실측

iOS와 Android의 같은 역할 에셋은 같은 크기라고 가정하지 않는다. 아래 값은 패키지 안 PNG를 직접 읽은 결과이며 매니페스트의 `samplePixelSize`, `sampleContentSize`, `sampleLogicalSize`에 저장된다.

| 역할 | iOS 샘플 | Android 샘플 | 렌더링 차이 |
|---|---:|---:|---|
| 메인/채팅 배경 | 1125×2250 → 375×750pt | 1440×2880 → 480×960dp 원본 | 각 OS 화면 폭에 맞춰 top-center crop |
| 하단 탭 배경 | 1410×147 → 470×49pt | 1442×214, 마커 제거 후 1440×212 → 360×53 | iOS 일반 이미지, Android 가이드에 명시된 4배 9-patch |
| 기본 프로필 01 | 360×360 → 120×120pt | 240×240 → 80×80dp | 앱이 표시 프레임 크기에 맞춰 각각 축소 |
| 말풍선 | 기본 120×105 → 40×35pt, 받은 말풍선 누림 `@3x` 121×105 | 124×114, 마커 제거 후 122×112 | iOS cap inset, Android 9-patch로 별도 렌더링 |
| 잠금 배경 | 1200×1200 → 400×400pt | 1440×1440 → 480×480dp | OS별 잠금 상단 surface에 center crop |
| 탭 아이콘 | 114×114 → 38×38pt | 114×114 → 38×38dp | 픽셀 크기는 같지만 선택/비선택 파일은 별도 |
| 잠금 불릿 | 132×132 → 44×44pt | 132×132 → 44×44dp | 기본/입력 상태 파일을 각각 사용 |

특히 Android `.9.png`의 바깥 1px 마커는 화면에 표시되는 이미지 크기에 포함하지 않는다. iOS 말풍선은 샘플 CSS의 stretch point와 content inset을 사용하며 Android 9-patch 마커와 공유하지 않는다.

`npm run audit:theme`은 각 OS에서 실제로 선택되는 iOS `@3x`/Android `xxhdpi` PNG의 IHDR 크기를 매니페스트와 대조하며, 한 픽셀이라도 다르면 실패한다.

사용자가 첨부한 이미지는 `platformResources.ios` / `platformResources.android`에 독립적으로 저장된다. 이전 공용 `resources` 폴백은 미리보기와 내보내기에서 사용하지 않아, iOS 이미지가 Android APK에 들어가거나 반대로 섬이는 경로를 차단한다.

## 임의 크기 업로드

사용자가 가이드의 권장 크기를 맞추지 않은 이미지를 첨부해도 테마를 생성할 수 있다.

- 배경·탭·아이콘: 각 공식 출력 표면 크기에 맞게 자동 리사이즈/크롭
- iOS 말풍선: 업로드한 논리 크기를 유지하고 `@2x`/`@3x`만 각각 생성
- Android 말풍선: 원본 내부 크기를 유지하고 외곽 1px 9-patch 마커만 생성
- Android `.9.png` 업로드: 기존 마커 테두리를 제거한 후 편집기의 stretch/content 값으로 재생성

실제 300×240 `chatroomBubbleSend01@3x.png`와 CSS stretch `33px 58px`, edge inset `57px 30px 19px 63px`을 회귀 사례로 추가했다. 이 경우 `@3x`는 300×240을 유지하고 `@2x`는 200×160으로 생성된다.

## 색상값 대조 결과

- Android `colors.xml`: 44개 키 전부 매핑
- iOS 25.8 샘플 CSS: 색상 44개 + alpha 5개 전부 매핑
- iOS 26.5 PDF에 추가되었지만 25.8 샘플에 없는 키:
  - `TabBarStyle-Main|background-color`
  - `MainViewStyle-Secondary|-ios-text-color`

두 추가 키는 새 iOS 테마 생성 시 CSS에 삽입된다. `SectionTitleStyle-Main|-ios-text-alpha`도 섹션 글자색의 alpha로 연결된다.

## 버전 차이

iOS PDF는 26.5.0이고 제공된 샘플은 25.8.0이다. 말풍선은 샘플 CSS에 저장된 stretch point와 edge inset을 실제 값으로 가져오며, 26.5 PDF의 예시 좌표로 임의 덮어쓰지 않는다.

- 25.8 보낸 말풍선: stretch `17px 17px`, inset `10 11 7 17`
- 25.8 받은 말풍선: stretch `22px 17px`, inset `10 17 7 11`
- 26.5 PDF 예시: stretch `20px 20px`, 보낸 inset `10 10 7 12`, 받은 inset `10 16 7 10`

## 채팅방 미리보기 좌표 검증

PDF 페이지를 화면 캡처로 재는 대신 PDF에 포함된 원본 스크린샷 XObject를 추출해 기준으로 삼는다. 시스템 상태바와 내비게이션 아이콘은 좌표 확인에만 사용하고 미리보기에는 그리지 않는다.

- iOS 원본: `750×1624` (`@2x`), 미리보기 표면 `375×750`
- Android 원본: `1080×2400`, PDF의 기기 화면 합성 폭을 `360`으로 정규화
- iOS 26.5 가이드 합성 화면의 말풍선 상단: 받은 첫 `129`, 받은 연속 `168`, 보낸 첫 `218`, 보낸 연속 `257`
- Android 26.5 가이드 합성 화면의 말풍선 상단: 받은 첫 `106`, 받은 연속 `148/190`, 보낸 첫 `236`, 보낸 연속 `278`
- iOS 보내기 버튼: `x=329, y=704, 32×32`
- Android 보내기 버튼: `x=308, y=715, 32×32`

현재 `layout/ios.ts`, `layout/android.ts`, `preview.css`의 메시지 시작 간격, 연속 말풍선 간격, Android 메시지 글자 크기, 입력바 버튼 위치는 위 좌표가 나오도록 검증한다. 말풍선 내부 여백과 늘어나는 구간은 이 좌표값으로 덮어쓰지 않고, 각 테마의 iOS CSS inset/cap 좌표와 Android `.9.png` 마커를 계속 사용한다.

## 복수 색상 컨트롤

26.5 입력바에서 한 컨트롤에 연결된 색상은 클릭 시 함께 편집할 수 있다.

- 입력 영역: 배경 + 텍스트
- 메뉴 버튼: 배경 + 아이콘 기본/누름(iOS), 배경 + 아이콘(Android)
- 보내기 버튼: 배경 기본/누름 + 아이콘 기본/누름(iOS), 배경 + 아이콘(Android)

색상 키 자체의 누락 여부는 `npm run audit:theme`에서 iOS 샘플 CSS와 Android `colors.xml` 전체를 대조한다.

## Splash 확인

- Android: 공식 소스와 APK에 세로/가로 6개 `theme_splash_image.png`가 있으며 매핑됨
- iOS: 제공된 25.8 `.ktheme` 122개 ZIP 엔트리와 58개 PNG, CSS, 26.5 iOS PDF 전체에 splash/launch 리소스가 없음

따라서 iOS 시작 화면에 대체 이미지나 임의 그림을 넣지 않는다.

## 기본 프로필과 다크 모드

- iOS와 Android 모두 `main.profile.01~03`으로 기본 프로필을 최대 3개까지 독립 관리한다.
- iOS는 등록된 슬롯만 `DefaultProfileStyle|-ios-profile-images`에 `'profileImg01.png''profileImg02.png''profileImg03.png'` 형식으로 기록한다.
- Android는 `theme_profile_01~03_image.png`로 출력하고, 상세 이미지는 Android만 `theme_profile_01~03_image_full.png`로 관리한다.
- 공통 다크 모드 ON은 iOS `-kakaotalk-theme-style: 'dark'`와 Android `com.kakao.talk.theme_style=dark` meta-data로 변환된다.
- OFF에서는 두 패키지의 dark 선언을 제거하여 공식 기본값인 Light로 동작한다.

## APK 편집 검증

Android APK를 source ZIP처럼 읽던 기존 경로를 수정했다. 컴파일된 `res/drawable-...-v4`, `res/drawable-sw600dp-...-v13`, `res/mipmap-...-v4` 경로를 원본 리소스 슬롯에 대응시킨다. 컴파일된 9-patch의 `npTc` 청크에서 stretch/content 구간도 복원한다.

공식 `apeach-26.1.0-debug.apk`를 직접 읽은 결과 37개 편집 슬롯, 배경, 프로필, 탭, 불릿, splash, 4개 말풍선이 복원되었다. 보낸 첫 말풍선은 컴파일된 122×112 PNG와 stretch `54..56 / 55..57`, content padding `20, 30, 12, 12` 값을 복원했다.

## 재검증

```sh
npm run audit:theme
npm test
npm run typecheck
```
