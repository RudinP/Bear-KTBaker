import { describe, expect, it } from 'vitest';
import { ERROR_CATALOG } from './errorCatalog';

describe('diagnostic error catalog', () => {
  it('defines unique, searchable public error codes', () => {
    expect(new Set(Object.keys(ERROR_CATALOG)).size)
      .toBe(Object.keys(ERROR_CATALOG).length);
    expect(Object.keys(ERROR_CATALOG)).toHaveLength(23);
    expect(Object.keys(ERROR_CATALOG).every(
      (code) => /^KTB-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code),
    )).toBe(true);
  });

  it('keeps the catalog metadata stable', () => {
    expect(ERROR_CATALOG).toEqual({
      'KTB-PROJECT-INVALID-FORMAT': {
        operation: 'project:open',
        stage: '프로젝트 파일 검증',
        message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
        source: 'src/domain/theme/codec.ts#parseThemeProject',
      },
      'KTB-PROJECT-MIGRATION': {
        operation: 'project:open',
        stage: '이전 프로젝트 변환',
        message: '이전 버전 프로젝트를 변환하지 못했습니다.',
        source: 'src/domain/theme/migrations/index.ts#migrateSchemaV1Project',
      },
      'KTB-THEME-UNSUPPORTED-FORMAT': {
        operation: 'theme:import',
        stage: '테마 파일 형식 확인',
        message: '지원하지 않는 테마 파일 형식입니다.',
        source: 'src/io/themeImport/detectImportKind.ts#detectThemeImportKind',
      },
      'KTB-IOS-IMPORT-ARCHIVE': {
        operation: 'theme:import',
        stage: 'iPhone 테마 압축 읽기',
        message: 'iPhone 테마 압축을 읽지 못했습니다.',
        source: 'src/io/themeImport/importIosTheme.ts#importIosKtheme',
      },
      'KTB-IOS-IMPORT-CSS': {
        operation: 'theme:import',
        stage: 'iPhone 테마 CSS 읽기',
        message: 'iPhone 테마 CSS를 읽지 못했습니다.',
        source: 'src/io/themeImport/iosCssDecoder.ts#decodeIosCss',
      },
      'KTB-IOS-EXPORT-TEMPLATE': {
        operation: 'theme:export-ios',
        stage: 'iPhone 템플릿 읽기',
        message: 'iPhone 테마 템플릿을 읽지 못했습니다.',
        source: 'src/application/theme/exportIosTheme.ts#exportIosTheme',
      },
      'KTB-ANDROID-IMPORT-ARCHIVE': {
        operation: 'theme:import',
        stage: 'Android 테마 압축 읽기',
        message: 'Android 테마 압축을 읽지 못했습니다.',
        source: 'src/io/themeImport/importAndroidTheme.ts#importAndroidThemeArchive',
      },
      'KTB-ANDROID-IMAGE-RECOVERY': {
        operation: 'theme:import',
        stage: 'Android 이미지 복원',
        message: 'Android 이미지 리소스를 복원하지 못했습니다.',
        source: 'src/io/themeImport/mappedImageImporter.ts#importMappedImages',
      },
      'KTB-ANDROID-RUNTIME-MISSING': {
        operation: 'theme:export-android',
        stage: 'Android 런타임 확인',
        message: 'Android APK 내보내기 런타임이 누락되었습니다.',
        source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk.runtime',
      },
      'KTB-ANDROID-AAPT2-COMPILE': {
        operation: 'theme:export-android',
        stage: 'APK 리소스 컴파일',
        message: 'Android 리소스 컴파일에 실패했습니다.',
        source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk.compile',
      },
      'KTB-ANDROID-AAPT2-LINK': {
        operation: 'theme:export-android',
        stage: 'APK 리소스 링크',
        message: 'Android 리소스를 APK에 연결하지 못했습니다.',
        source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk.link',
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
        source: 'electron/adapters/electronImageProcessor.ts#decode',
      },
      'KTB-IMAGE-NINE-PATCH': {
        operation: 'theme:import',
        stage: '9-patch 해석',
        message: '9-patch 정보를 읽지 못했습니다.',
        source: 'src/io/ninePatchPng.ts#parseCompiledNinePatchPng',
      },
      'KTB-FS-READ': {
        operation: 'theme:import',
        stage: '파일 읽기',
        message: '파일을 읽지 못했습니다.',
        source: 'electron/adapters/nodeFileSystem.ts#read',
      },
      'KTB-FS-WRITE': {
        operation: 'project:save',
        stage: '파일 쓰기',
        message: '파일을 저장하지 못했습니다.',
        source: 'electron/adapters/nodeFileSystem.ts#write',
      },
      'KTB-FS-TEMP': {
        operation: 'theme:export-android',
        stage: '임시 작업 폴더',
        message: '임시 작업 폴더를 처리하지 못했습니다.',
        source: 'electron/adapters/nodeFileSystem.ts#temporaryDirectory',
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
        source: 'electron/ipc/requestValidation.ts',
      },
      'KTB-IPC-BRIDGE-UNAVAILABLE': {
        operation: 'ipc:validate',
        stage: '렌더러 브리지 연결',
        message: 'Electron 앱 기능에 연결하지 못했습니다.',
        source: 'src/app/themeStudioClient.ts#createThemeStudioClient',
      },
      'KTB-UNKNOWN-UNEXPECTED': {
        operation: 'ipc:validate',
        stage: '알 수 없는 작업',
        message: '예상하지 못한 오류가 발생했습니다.',
        source: 'electron/ipc/errorBoundary.ts#withIpcErrorBoundary',
      },
    });
  });
});
