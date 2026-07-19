import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../src/domain/theme';
import {
  parseProjectSaveRequest,
  parseScreenshotSaveRequests,
  parseThemeProjectRequest,
} from './requestValidation';

describe('IPC request validation', () => {
  it('accepts a project save request without widening its shape', () => {
    expect(parseProjectSaveRequest({
      content: '{"schema":"kakao-theme-studio"}',
      suggestedName: 'theme',
      ignored: true,
    })).toEqual({
      content: '{"schema":"kakao-theme-studio"}',
      suggestedName: 'theme',
    });
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

  it('accepts screenshot image data and strips unknown properties', () => {
    expect(parseScreenshotSaveRequests([{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
      ignored: true,
    }])).toEqual([{
      name: 'preview.png',
      dataUrl: 'data:image/png;base64,AA==',
    }]);
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
