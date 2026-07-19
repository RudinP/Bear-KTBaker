import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ['src', 'electron', 'scripts'].map((directory) =>
  path.join(projectRoot, directory),
);

function repositoryPath(file: string) {
  return path.relative(projectRoot, file).split(path.sep).join('/');
}

function isTypeScriptSource(file: string) {
  return /\.(?:ts|tsx)$/.test(file);
}

function isProductionSource(file: string) {
  return (
    isTypeScriptSource(file) &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) &&
    !file.endsWith('.d.ts')
  );
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectFiles(entryPath)
      : isTypeScriptSource(entryPath)
        ? [entryPath]
        : [];
  });
}

function staticImportSpecifiers(file: string) {
  const sourceText = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];

  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function resolvedRepositoryTarget(file: string, specifier: string) {
  if (!specifier.startsWith('.')) return undefined;
  return repositoryPath(path.resolve(path.dirname(file), specifier)).replace(
    /\.(?:ts|tsx)$/,
    '',
  );
}

function importsPackage(specifier: string, packageName: string) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

const allFiles = sourceRoots.flatMap(collectFiles);
const productionFiles = allFiles.filter(isProductionSource);
const importsByFile = new Map(
  allFiles.map((file) => [file, staticImportSpecifiers(file)]),
);

describe('dependency direction', () => {
  it('keeps domain modules independent from runtime frameworks and Node', () => {
    const forbiddenPackages = ['react', 'electron', 'jszip', 'pngjs'];
    const violations = productionFiles
      .filter((file) => repositoryPath(file).startsWith('src/domain/'))
      .flatMap((file) =>
        (importsByFile.get(file) ?? [])
          .filter(
            (specifier) =>
              specifier.startsWith('node:') ||
              forbiddenPackages.some((packageName) =>
                importsPackage(specifier, packageName),
              ),
          )
          .map((specifier) => `${repositoryPath(file)} imports ${specifier}`),
      );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps application modules independent from UI and platform runtimes', () => {
    const forbiddenPackages = ['react', 'react-dom', 'electron'];
    const violations = productionFiles
      .filter((file) => repositoryPath(file).startsWith('src/application/'))
      .flatMap((file) =>
        (importsByFile.get(file) ?? [])
          .filter((specifier) => {
            const target = resolvedRepositoryTarget(file, specifier);
            return (
              specifier.startsWith('node:') ||
              forbiddenPackages.some((packageName) =>
                importsPackage(specifier, packageName),
              ) ||
              specifier.includes('/components/') ||
              specifier.includes('/electron/') ||
              target?.startsWith('src/components/') ||
              target?.startsWith('electron/')
            );
          })
          .map((specifier) => `${repositoryPath(file)} imports ${specifier}`),
      );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('does not let IO modules depend back on application modules', () => {
    const violations = productionFiles
      .filter((file) => repositoryPath(file).startsWith('src/io/'))
      .flatMap((file) =>
        (importsByFile.get(file) ?? [])
          .filter((specifier) =>
            specifier.includes('/application/') ||
            resolvedRepositoryTarget(file, specifier)?.startsWith(
              'src/application/',
            ),
          )
          .map((specifier) => `${repositoryPath(file)} imports ${specifier}`),
      );

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('renderer platform access', () => {
  it('routes direct preload access through themeStudioClient', () => {
    const violations = productionFiles
      .filter((file) => repositoryPath(file).startsWith('src/'))
      .filter((file) => repositoryPath(file) !== 'src/app/themeStudioClient.ts')
      .filter((file) => /\bwindow\.themeStudio\b/.test(readFileSync(file, 'utf8')))
      .map(repositoryPath);

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

describe('internal compatibility facades', () => {
  it('has no consumers of obsolete internal import paths', () => {
    const sourceTarget = (...segments: string[]) => segments.join('/');
    const forbiddenTargets = new Set([
      sourceTarget('src', 'domain', 'theme'),
      sourceTarget('src', 'io', 'themeImport'),
      sourceTarget('src', 'io', 'androidStandaloneBuild'),
      sourceTarget('src', 'components', 'PhonePreview'),
    ]);
    const forbiddenSpecifier =
      /(?:^|\/)(?:domain\/theme|io\/themeImport|io\/androidStandaloneBuild|components\/PhonePreview)$/;
    const violations = allFiles.flatMap((file) =>
      (importsByFile.get(file) ?? [])
        .filter((specifier) => {
          const resolvedTarget = resolvedRepositoryTarget(file, specifier);
          return (
            forbiddenSpecifier.test(specifier.replace(/\.(?:ts|tsx)$/, '')) ||
            (resolvedTarget !== undefined &&
              forbiddenTargets.has(resolvedTarget))
          );
        })
        .map((specifier) => `${repositoryPath(file)} imports ${specifier}`),
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
