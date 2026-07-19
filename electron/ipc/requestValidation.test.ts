import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../src/domain/theme';
import { nestedAssetsV1Fixture } from '../../src/test/fixtures/legacyThemeProjects';
import {
  parseProjectSaveRequest,
  parseScreenshotSaveRequests,
  parseThemeProjectRequest,
} from './requestValidation';

describe('IPC request validation', () => {
  it('accepts an exact project save request', () => {
    expect(parseProjectSaveRequest({
      content: '{"schema":"kakao-theme-studio"}',
      suggestedName: 'theme',
    })).toEqual({
      content: '{"schema":"kakao-theme-studio"}',
      suggestedName: 'theme',
    });
  });

  it('accepts exact fixed DTOs with a null prototype', () => {
    const projectSave = Object.assign(Object.create(null), {
      content: '{}',
      suggestedName: 'theme',
    });
    const screenshot = Object.assign(Object.create(null), {
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    });

    expect(parseProjectSaveRequest(projectSave)).toEqual({
      content: '{}',
      suggestedName: 'theme',
    });
    expect(parseScreenshotSaveRequests([screenshot])).toEqual([{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }]);
  });

  it.each([
    {
      content: '{}',
      suggestedName: 'theme',
      ignored: true,
    },
    Object.assign({
      content: '{}',
      suggestedName: 'theme',
    }, { [Symbol('secret')]: true }),
    new (class ProjectSaveRequest {
      content = '{}';
      suggestedName = 'theme';
    })(),
    Object.assign(Object.create({ inherited: true }), {
      content: '{}',
      suggestedName: 'theme',
    }),
  ])('rejects non-exact project save request shapes', (value) => {
    expect(() => parseProjectSaveRequest(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('rejects project save accessors without invoking them', () => {
    const content = vi.fn(() => '{}');
    const value = {
      get content() {
        return content();
      },
      suggestedName: 'theme',
    };

    expect(() => parseProjectSaveRequest(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(content).not.toHaveBeenCalled();
  });

  it('rejects invalid project save requests before dialog or file work', () => {
    const showDialog = vi.fn();
    const write = vi.fn();
    const handle = (value: unknown) => {
      const request = parseProjectSaveRequest(value);
      showDialog(request.suggestedName);
      write(request.content);
    };

    expect(() => handle({
      content: 3,
      suggestedName: 'theme',
    })).toThrow(expect.objectContaining({
      code: 'KTB-IPC-INVALID-REQUEST',
    }));
    expect(() => handle({
      content: '{}',
      suggestedName: '  ',
    })).toThrow(expect.objectContaining({
      code: 'KTB-IPC-INVALID-REQUEST',
    }));
    expect(showDialog).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('validates theme projects through the project codec', () => {
    const project = createDefaultTheme('검증 테마');

    expect(parseThemeProjectRequest(project)).toMatchObject({
      schema: 'kakao-theme-studio',
      schemaVersion: 1,
      meta: { name: '검증 테마' },
    });
    expect(() => parseThemeProjectRequest({ schema: 'other' })).toThrow(
      expect.objectContaining({
        code: 'KTB-IPC-INVALID-REQUEST',
        cause: expect.any(Error),
      }),
    );
    expect(() => parseThemeProjectRequest('not a project')).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('preserves plain legacy fields for project codec migration', () => {
    const parsed = parseThemeProjectRequest(nestedAssetsV1Fixture());

    expect(parsed.platformResources.ios['common.theme-icon']?.fileName)
      .toBe('theme-icon.png');
    expect(parsed.platformResources.android['main.tab.background']?.fileName)
      .toBe('tab-background.png');
  });

  it('preserves unknown plain ThemeProject fields through the codec', () => {
    const project = {
      ...createDefaultTheme(),
      legacyMystery: { keep: ['plain', 1, true, null] },
    };

    const parsed = parseThemeProjectRequest(project) as unknown as {
      legacyMystery: unknown;
    };
    expect(parsed.legacyMystery).toEqual({
      keep: ['plain', 1, true, null],
    });
  });

  it.each([
    Object.assign(createDefaultTheme(), { [Symbol('secret')]: true }),
    Object.assign(createDefaultTheme(), {
      legacyMystery: new (class LegacyValue {
        keep = true;
      })(),
    }),
    Object.assign(createDefaultTheme(), {
      legacyMystery: Object.assign(
        Object.create({ inherited: true }),
        { keep: true },
      ),
    }),
    Object.assign(createDefaultTheme(), { legacyMystery: undefined }),
    Object.assign(createDefaultTheme(), { legacyMystery: 1n }),
    Object.assign(createDefaultTheme(), { legacyMystery: Number.NaN }),
    Object.assign(createDefaultTheme(), { legacyMystery: Number.POSITIVE_INFINITY }),
  ])('rejects non-inert ThemeProject values', (value) => {
    expect(() => parseThemeProjectRequest(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('rejects ThemeProject accessors and toJSON without invoking them', () => {
    const accessor = vi.fn(() => ({ keep: true }));
    const toJSON = vi.fn(() => ({ schema: 'other' }));
    const withAccessor = createDefaultTheme() as unknown as Record<string, unknown>;
    Object.defineProperty(withAccessor, 'legacyMystery', {
      enumerable: true,
      get: accessor,
    });
    const withToJson = Object.assign(createDefaultTheme(), { toJSON });

    expect(() => parseThemeProjectRequest(withAccessor)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(() => parseThemeProjectRequest(withToJson)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(accessor).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('rejects cyclic and unsafe-depth ThemeProject input', () => {
    const cyclic = createDefaultTheme() as unknown as Record<string, unknown>;
    cyclic.legacyCycle = cyclic;
    const deep = createDefaultTheme() as unknown as Record<string, unknown>;
    let cursor: Record<string, unknown> = deep;
    for (let depth = 0; depth < 100; depth += 1) {
      const next: Record<string, unknown> = {};
      cursor.legacyDeep = next;
      cursor = next;
    }

    expect(() => parseThemeProjectRequest(cyclic)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(() => parseThemeProjectRequest(deep)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('rejects inherited root ThemeProject fields', () => {
    const inherited = Object.assign(
      Object.create(createDefaultTheme()),
      { legacyMystery: true },
    );

    expect(() => parseThemeProjectRequest(inherited)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('accepts exact screenshot image data', () => {
    expect(parseScreenshotSaveRequests([{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }])).toEqual([{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }]);
  });

  it.each([
    [{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
      ignored: true,
    }],
    [Object.assign({
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }, { [Symbol('secret')]: true })],
    [new (class ScreenshotRequest {
      name = 'preview.png';
      dataUrl = 'data:image/png;base64,AA==';
    })()],
    [Object.assign(Object.create({ inherited: true }), {
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    })],
  ])('rejects non-exact screenshot DTO shapes', (value) => {
    expect(() => parseScreenshotSaveRequests(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('rejects screenshot accessors without invoking them', () => {
    const name = vi.fn(() => 'preview.png');
    const value = [{
      get name() {
        return name();
      },
      dataUrl: 'data:image/png;base64,AA==',
    }];

    expect(() => parseScreenshotSaveRequests(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(name).not.toHaveBeenCalled();
  });

  it('rejects screenshot arrays with extra or symbol properties', () => {
    const withExtra = [{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }] as Array<unknown> & { extra?: boolean };
    withExtra.extra = true;
    const withSymbol = [{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }];
    Object.assign(withSymbol, { [Symbol('secret')]: true });

    expect(() => parseScreenshotSaveRequests(withExtra)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
    expect(() => parseScreenshotSaveRequests(withSymbol)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });

  it('uses a generic invalid-request diagnostic without reflecting input', () => {
    const secretKey = 'privateSecretField';
    let caught: unknown;
    try {
      parseProjectSaveRequest({
        content: '{}',
        suggestedName: 'theme',
        [secretKey]: 'private-secret-value',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'KTB-IPC-INVALID-REQUEST',
      message: '앱 요청 데이터가 올바르지 않습니다.',
      stage: '요청 데이터 검증',
    });
    expect(String(caught)).not.toContain(secretKey);
    expect(String(caught)).not.toContain('private-secret-value');
  });

  it.each([
    null,
    {},
    [{ name: '', dataUrl: 'data:image/png;base64,AA==' }],
    [{ name: '../preview.png', dataUrl: 'data:image/png;base64,AA==' }],
    [{ name: String.raw`folder\preview.png`, dataUrl: 'data:image/png;base64,AA==' }],
    [{ name: 'preview.png', dataUrl: 'data:text/plain;base64,AA==' }],
  ])('rejects unsafe screenshot requests: %j', (value) => {
    expect(() => parseScreenshotSaveRequests(value)).toThrow(
      expect.objectContaining({ code: 'KTB-IPC-INVALID-REQUEST' }),
    );
  });
});
