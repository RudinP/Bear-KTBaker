export type ThemeOperation =
  | 'project:open'
  | 'project:save'
  | 'theme:import'
  | 'theme:export-ios'
  | 'theme:export-android'
  | 'screenshots:save'
  | 'ipc:validate';

export interface ErrorCatalogDiagnostic {
  operation: ThemeOperation;
  stage: string;
  message: string;
  source: `${string}#${string}`;
}

export interface ErrorCatalogEntry extends ErrorCatalogDiagnostic {
  variants?: readonly ErrorCatalogDiagnostic[];
}

export const ERROR_CATALOG = {
  'KTB-PROJECT-INVALID-FORMAT': {
    operation: 'project:open',
    stage: '프로젝트 파일 검증',
    message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
    source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
    variants: [
      {
        operation: 'project:save',
        stage: '프로젝트 파일 검증',
        message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
        source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
      },
      {
        operation: 'theme:import',
        stage: '프로젝트 파일 검증',
        message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
        source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
      },
    ],
  },
  'KTB-PROJECT-MIGRATION': {
    operation: 'project:open',
    stage: '이전 프로젝트 변환',
    message: '이전 버전 프로젝트를 변환하지 못했습니다.',
    source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
    variants: [
      {
        operation: 'project:save',
        stage: '이전 프로젝트 변환',
        message: '이전 버전 프로젝트를 변환하지 못했습니다.',
        source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
      },
      {
        operation: 'theme:import',
        stage: '이전 프로젝트 변환',
        message: '이전 버전 프로젝트를 변환하지 못했습니다.',
        source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
      },
    ],
  },
  'KTB-THEME-UNSUPPORTED-FORMAT': {
    operation: 'theme:import',
    stage: '테마 파일 형식 확인',
    message: '지원하지 않는 테마 파일 형식입니다.',
    source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
  },
  'KTB-IOS-IMPORT-ARCHIVE': {
    operation: 'theme:import',
    stage: 'iPhone 테마 압축 읽기',
    message: 'iPhone 테마 압축을 읽지 못했습니다.',
    source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
  },
  'KTB-IOS-IMPORT-CSS': {
    operation: 'theme:import',
    stage: 'iPhone 테마 CSS 읽기',
    message: 'iPhone 테마 CSS를 읽지 못했습니다.',
    source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
  },
  'KTB-IOS-EXPORT-TEMPLATE': {
    operation: 'theme:export-ios',
    stage: 'iPhone 템플릿 읽기',
    message: 'iPhone 테마 템플릿을 읽지 못했습니다.',
    source: 'src/application/theme/exportIosTheme.ts#readIosTemplate',
    variants: [
      {
        operation: 'theme:export-ios',
        stage: 'iPhone 템플릿 압축 읽기',
        message: 'iPhone 테마 템플릿을 읽지 못했습니다.',
        source: 'src/application/theme/exportIosTheme.ts#decodeIosTemplate',
      },
      {
        operation: 'theme:export-ios',
        stage: 'iPhone 템플릿 CSS 읽기',
        message: 'iPhone 테마 템플릿 CSS를 읽지 못했습니다.',
        source: 'src/application/theme/exportIosTheme.ts#requireIosCss',
      },
    ],
  },
  'KTB-ANDROID-IMPORT-ARCHIVE': {
    operation: 'theme:import',
    stage: 'Android 테마 압축 읽기',
    message: 'Android 테마 압축을 읽지 못했습니다.',
    source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
  },
  'KTB-ANDROID-IMAGE-RECOVERY': {
    operation: 'theme:import',
    stage: 'Android 이미지 복원',
    message: 'Android 이미지 리소스를 복원하지 못했습니다.',
    source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
  },
  'KTB-ANDROID-RUNTIME-MISSING': {
    operation: 'theme:export-android',
    stage: 'Android 런타임 확인',
    message: 'Android APK 내보내기 런타임이 누락되었습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk',
  },
  'KTB-ANDROID-AAPT2-COMPILE': {
    operation: 'theme:export-android',
    stage: 'APK 리소스 컴파일',
    message: 'Android 리소스 컴파일에 실패했습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk',
  },
  'KTB-ANDROID-AAPT2-LINK': {
    operation: 'theme:export-android',
    stage: 'APK 리소스 링크',
    message: 'Android 리소스를 APK에 연결하지 못했습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk',
  },
  'KTB-ANDROID-SIGNING-IDENTITY': {
    operation: 'theme:export-android',
    stage: 'Android 서명 정보 준비',
    message: 'Android 서명 정보를 준비하지 못했습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#loadOrCreateSigningIdentity',
  },
  'KTB-ANDROID-SIGN': {
    operation: 'theme:export-android',
    stage: 'Android APK 서명',
    message: 'Android APK 서명에 실패했습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#signStandaloneApk',
  },
  'KTB-ANDROID-VERIFY': {
    operation: 'theme:export-android',
    stage: 'Android APK 검증',
    message: 'Android APK 검증에 실패했습니다.',
    source: 'electron/adapters/androidStandaloneBuild.ts#verifyStandaloneApkStructure',
  },
  'KTB-IMAGE-DECODE': {
    operation: 'theme:import',
    stage: '이미지 디코딩',
    message: '이미지 파일을 읽지 못했습니다.',
    source: 'src/application/errors/ipcPayload.ts#serializeThemeStudioError',
    variants: [
      {
        operation: 'theme:export-ios',
        stage: 'iPhone 이미지 디코딩',
        message: 'iPhone 테마 이미지를 읽지 못했습니다.',
        source: 'src/application/theme/renderIosImages.ts#renderIosImages',
      },
      {
        operation: 'theme:export-ios',
        stage: 'iPhone 이미지 변환',
        message: 'iPhone 테마 이미지를 변환하지 못했습니다.',
        source: 'src/application/theme/renderIosImages.ts#renderIosImages',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 이미지 디코딩',
        message: 'Android 테마 이미지를 읽지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 이미지 템플릿 디코딩',
        message: 'Android 이미지 템플릿을 읽지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 이미지 변환',
        message: 'Android 테마 이미지를 변환하지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
      {
        operation: 'screenshots:save',
        stage: '홍보 이미지 디코딩',
        message: '홍보 이미지 데이터를 읽지 못했습니다.',
        source: 'src/application/screenshots/saveScreenshots.ts#imageDecodeError',
      },
      {
        operation: 'screenshots:save',
        stage: '홍보 이미지 디코딩',
        message: '홍보 이미지는 PNG 형식이어야 합니다.',
        source: 'src/application/screenshots/saveScreenshots.ts#assertPngDataUrl',
      },
    ],
  },
  'KTB-IMAGE-NINE-PATCH': {
    operation: 'theme:import',
    stage: '9-patch 해석',
    message: '9-patch 정보를 읽지 못했습니다.',
    source: 'src/application/errors/ipcPayload.ts#serializeThemeStudioError',
    variants: [
      {
        operation: 'theme:export-android',
        stage: 'Android 9-patch 템플릿 적용',
        message: 'Android 9-patch 기준 이미지를 찾지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
    ],
  },
  'KTB-FS-READ': {
    operation: 'theme:import',
    stage: '파일 읽기',
    message: '파일을 읽지 못했습니다.',
    source: 'src/application/errors/ipcPayload.ts#serializeThemeStudioError',
    variants: [
      {
        operation: 'project:open',
        stage: '프로젝트 파일 읽기',
        message: '프로젝트 파일을 읽지 못했습니다.',
        source: 'src/application/theme/openProject.ts#createOpenProject',
      },
      {
        operation: 'project:open',
        stage: '프로젝트 열기',
        message: '프로젝트를 열지 못했습니다.',
        source: 'electron/ipc/registerThemeIpc.ts#registerThemeIpc',
      },
      {
        operation: 'theme:import',
        stage: '선택한 테마 파일 읽기',
        message: '선택한 테마 파일을 읽지 못했습니다.',
        source: 'src/application/theme/importTheme.ts#readSelectedBytes',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 템플릿 읽기',
        message: 'Android 테마 템플릿을 읽지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#createExportAndroidTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 템플릿 압축 읽기',
        message: 'Android 테마 템플릿 압축을 읽지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#createExportAndroidTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 이미지 템플릿 읽기',
        message: 'Android 이미지 템플릿을 읽지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
    ],
  },
  'KTB-FS-WRITE': {
    operation: 'project:save',
    stage: '파일 쓰기',
    message: '파일을 저장하지 못했습니다.',
    source: 'src/application/errors/ipcPayload.ts#serializeThemeStudioError',
    variants: [
      {
        operation: 'project:save',
        stage: '프로젝트 파일 쓰기',
        message: '프로젝트 파일을 저장하지 못했습니다.',
        source: 'src/application/theme/saveProject.ts#createSaveProject',
      },
      {
        operation: 'project:save',
        stage: '프로젝트 저장',
        message: '프로젝트를 저장하지 못했습니다.',
        source: 'electron/ipc/registerThemeIpc.ts#registerThemeIpc',
      },
      {
        operation: 'theme:export-ios',
        stage: 'iPhone 테마 파일 쓰기',
        message: 'iPhone 테마 파일을 저장하지 못했습니다.',
        source: 'src/application/theme/exportIosTheme.ts#writeIosTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 템플릿 압축 해제',
        message: 'Android 테마 템플릿을 준비하지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#extractAndroidTemplate',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 메타데이터 생성',
        message: 'Android 테마 메타데이터를 만들지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#writeAndroidProjectMetadata',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android APK 파일 복사',
        message: '완성된 Android APK를 저장하지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#createExportAndroidTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 이미지 리소스 쓰기',
        message: 'Android 이미지 리소스를 저장하지 못했습니다.',
        source: 'src/application/theme/renderAndroidImages.ts#renderAndroidImages',
      },
      {
        operation: 'screenshots:save',
        stage: '홍보 이미지 파일 쓰기',
        message: '홍보 이미지를 저장하지 못했습니다.',
        source: 'src/application/screenshots/saveScreenshots.ts#createSaveScreenshots',
      },
    ],
  },
  'KTB-FS-TEMP': {
    operation: 'theme:export-android',
    stage: '임시 작업 폴더',
    message: '임시 작업 폴더를 처리하지 못했습니다.',
    source: 'src/application/errors/ipcPayload.ts#serializeThemeStudioError',
    variants: [
      {
        operation: 'theme:export-android',
        stage: 'Android 임시 폴더 생성',
        message: 'Android 임시 작업 폴더를 만들지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#createExportAndroidTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 임시 폴더 정리',
        message: 'Android 임시 작업 폴더를 정리하지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#cleanupTemporaryDirectory',
      },
    ],
  },
  'KTB-IPC-UNTRUSTED-SENDER': {
    operation: 'ipc:validate',
    stage: '요청 화면 검증',
    message: '허용되지 않은 화면 요청입니다.',
    source: 'electron/ipc/trustedSender.ts#assertTrustedSender',
  },
  'KTB-IPC-INVALID-REQUEST': {
    operation: 'ipc:validate',
    stage: '요청 데이터 검증',
    message: '앱 요청 데이터가 올바르지 않습니다.',
    source: 'electron/ipc/requestValidation.ts#invalidRequest',
    variants: [
      {
        operation: 'screenshots:save',
        stage: '홍보 이미지 파일명 검증',
        message: '홍보 이미지 파일명이 올바르지 않습니다.',
        source: 'src/application/screenshots/saveScreenshots.ts#assertSafeScreenshotName',
      },
    ],
  },
  'KTB-IPC-BRIDGE-UNAVAILABLE': {
    operation: 'ipc:validate',
    stage: '렌더러 브리지 연결',
    message: 'Electron 앱 기능에 연결하지 못했습니다.',
    source: 'electron/preload.ts#invokeOrThrow',
  },
  'KTB-UNKNOWN-UNEXPECTED': {
    operation: 'ipc:validate',
    stage: '알 수 없는 작업',
    message: '예상하지 못한 오류가 발생했습니다.',
    source: 'electron/ipc/errorBoundary.ts#withIpcErrorBoundary',
    variants: [
      {
        operation: 'theme:import',
        stage: '알 수 없는 작업',
        message: '예상하지 못한 오류가 발생했습니다.',
        source: 'electron/ipc/registerThemeIpc.ts#unexpectedFallback',
      },
      {
        operation: 'theme:export-ios',
        stage: '알 수 없는 작업',
        message: '예상하지 못한 오류가 발생했습니다.',
        source: 'electron/ipc/registerThemeIpc.ts#unexpectedFallback',
      },
      {
        operation: 'screenshots:save',
        stage: '알 수 없는 작업',
        message: '예상하지 못한 오류가 발생했습니다.',
        source: 'electron/ipc/registerThemeIpc.ts#unexpectedFallback',
      },
      {
        operation: 'theme:import',
        stage: '테마 가져오기',
        message: '테마를 가져오지 못했습니다.',
        source: 'src/application/theme/importErrorMapping.ts#mapThemeImportFailure',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android 테마 내보내기',
        message: 'Android 테마를 내보내지 못했습니다.',
        source: 'src/application/theme/exportAndroidTheme.ts#createExportAndroidTheme',
      },
      {
        operation: 'theme:export-android',
        stage: 'Android APK 빌드',
        message: 'Android APK를 만들지 못했습니다.',
        source: 'electron/adapters/androidToolRunner.ts#createAndroidApkBuilder',
      },
      {
        operation: 'ipc:validate',
        stage: '오류 응답 검증',
        message: '앱 오류 응답을 읽지 못했습니다.',
        source: 'src/application/errors/ipcPayload.ts#reconstructThemeStudioError',
      },
    ],
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string'
    && Object.hasOwn(ERROR_CATALOG, value);
}

export function normalizeErrorCode(value: unknown): ErrorCode {
  return isErrorCode(value)
    ? value
    : 'KTB-UNKNOWN-UNEXPECTED';
}

export function resolveCatalogDiagnostic(
  code: ErrorCode,
  details: Pick<ErrorCatalogDiagnostic, 'operation' | 'stage' | 'message'>,
): ErrorCatalogDiagnostic {
  const entry = ERROR_CATALOG[code] as ErrorCatalogEntry;
  return [entry, ...(entry.variants ?? [])].find(
    (candidate) =>
      candidate.operation === details.operation
      && candidate.stage === details.stage
      && candidate.message === details.message,
  ) ?? entry;
}

export function isCatalogDiagnostic(
  code: ErrorCode,
  details: Pick<ErrorCatalogDiagnostic, 'operation' | 'stage' | 'message'>,
): boolean {
  const entry = ERROR_CATALOG[code] as ErrorCatalogEntry;
  return [entry, ...(entry.variants ?? [])].some(
    (candidate) =>
      candidate.operation === details.operation
      && candidate.stage === details.stage
      && candidate.message === details.message,
  );
}
