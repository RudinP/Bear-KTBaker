import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CATALOG,
  type ErrorCatalogEntry,
} from './errorCatalog';

describe('diagnostic error catalog', () => {
  it('defines unique, searchable public error codes', () => {
    expect(new Set(Object.keys(ERROR_CATALOG)).size)
      .toBe(Object.keys(ERROR_CATALOG).length);
    expect(Object.keys(ERROR_CATALOG)).toHaveLength(23);
    expect(Object.keys(ERROR_CATALOG).every(
      (code) => /^KTB-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code),
    )).toBe(true);
  });

  it('keeps stable catalog defaults for public compatibility', () => {
    expect(ERROR_CATALOG['KTB-PROJECT-INVALID-FORMAT']).toMatchObject({
      operation: 'project:open',
      stage: '프로젝트 파일 검증',
      message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
      source: 'src/application/theme/projectErrorMapping.ts#mapProjectCodecFailure',
    });
    expect(ERROR_CATALOG['KTB-IPC-BRIDGE-UNAVAILABLE']).toEqual({
      operation: 'ipc:validate',
      stage: '렌더러 브리지 연결',
      message: 'Electron 앱 기능에 연결하지 못했습니다.',
      source: 'electron/preload.ts#invokeOrThrow',
    });
    expect(ERROR_CATALOG['KTB-UNKNOWN-UNEXPECTED']).toMatchObject({
      operation: 'ipc:validate',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
    });
  });

  it('points every catalog entry and variant at an existing source anchor', async () => {
    for (const value of Object.values(ERROR_CATALOG)) {
      const entry = value as ErrorCatalogEntry;
      const locations = [entry, ...(entry.variants ?? [])];
      for (const location of locations) {
        const [file, anchor, ...rest] = location.source.split('#');
        expect(rest, location.source).toHaveLength(0);
        expect(anchor, location.source).toBeTruthy();
        const contents = await readFile(resolve(file), 'utf8');
        const sourceFile = ts.createSourceFile(
          file,
          contents,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx')
            ? ts.ScriptKind.TSX
            : ts.ScriptKind.TS,
        );
        expect(
          collectDeclaredIdentifiers(sourceFile),
          location.source,
        ).toContain(anchor);
      }
    }
  });
});

function collectDeclaredIdentifiers(
  sourceFile: ts.SourceFile,
): string[] {
  const identifiers = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node)
      || ts.isEnumDeclaration(node)
      || ts.isMethodDeclaration(node)
      || ts.isPropertyDeclaration(node)
    ) {
      if (node.name && ts.isIdentifier(node.name)) {
        identifiers.add(node.name.text);
      }
    } else if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
    ) {
      identifiers.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...identifiers];
}
