# Bear KTBaker

Bear KTBaker는 iPhone과 Android용 카카오톡 사용자 테마를 함께 제작하는 Electron 데스크톱 앱입니다.

## 주요 기능

- 공식 샘플 리소스를 기반으로 한 iPhone·Android 화면 미리보기
- 이미지, 색상, 글꼴 및 프로필 리소스 편집
- iOS inset과 Android 9-patch 영역 조정
- `.ktheme` 및 `.apk` 내보내기
- `.ktstudio` 프로젝트 저장 및 다시 불러오기
- 테마 홍보 이미지 PNG 생성

## 개발 환경

Node.js 22 이상을 권장합니다.

```bash
npm install
npm run dev
```

## 검증

```bash
npm run verify
npm run audit:theme
npm run verify:android-runtime
```

## 패키징

```bash
npm run package:mac
npm run package:win
```

빌드 결과물은 `release/`에 생성되며 Git에는 포함되지 않습니다.

## 안내

KakaoTalk과 Kakao는 해당 권리자의 상표입니다. 이 프로젝트는 Kakao의 공식 제품이 아닙니다.
