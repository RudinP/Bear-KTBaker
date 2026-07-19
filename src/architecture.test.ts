import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ['src', 'electron', 'scripts'].map((directory) =>
  path.join(projectRoot, directory),
);

function loadCompilerOptions(configName: string) {
  const configFile = path.join(projectRoot, configName);
  const loaded = ts.readConfigFile(configFile, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(
      ts.formatDiagnostics([loaded.error], {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => '\n',
      }),
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    path.dirname(configFile),
    undefined,
    configFile,
  );
  if (parsed.errors.length) {
    throw new Error(
      ts.formatDiagnostics(parsed.errors, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => '\n',
      }),
    );
  }
  return parsed.options;
}

const compilerOptionsBySourceRoot = new Map([
  ['src', loadCompilerOptions('tsconfig.app.json')],
  ['electron', loadCompilerOptions('tsconfig.node.json')],
  ['scripts', loadCompilerOptions('tsconfig.scripts.json')],
]);

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

const sourceTarget = (...segments: string[]) => segments.join('/');
const forbiddenFacadeTargets = new Set([
  sourceTarget('src', 'domain', 'theme'),
  sourceTarget('src', 'io', 'themeImport'),
  sourceTarget('src', 'io', 'androidStandaloneBuild'),
  sourceTarget('src', 'components', 'PhonePreview'),
]);

function compilerOptionsForFile(file: string) {
  const [sourceRoot] = repositoryPath(file).split('/');
  const compilerOptions = compilerOptionsBySourceRoot.get(sourceRoot);
  if (!compilerOptions) {
    throw new Error(`No TypeScript configuration for ${repositoryPath(file)}`);
  }
  return compilerOptions;
}

function normalizeRepositoryModulePath(file: string) {
  const relative = path.relative(projectRoot, file);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return relative
    .split(path.sep)
    .join('/')
    .replace(/(?:\.d)?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
}

function aliasMatch(pattern: string, specifier: string) {
  const wildcard = pattern.indexOf('*');
  if (wildcard === -1) return pattern === specifier ? '' : undefined;
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return undefined;
  }
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

function unresolvedFacadeTarget(
  file: string,
  specifier: string,
  compilerOptions: ts.CompilerOptions,
) {
  const candidates: string[] = [];
  if (specifier.startsWith('.')) {
    candidates.push(path.resolve(path.dirname(file), specifier));
  } else {
    const configFilePath = compilerOptions.configFilePath;
    const baseUrl =
      compilerOptions.baseUrl ??
      (typeof configFilePath === 'string'
        ? path.dirname(configFilePath)
        : projectRoot);
    for (const [pattern, substitutions] of Object.entries(
      compilerOptions.paths ?? {},
    )) {
      const match = aliasMatch(pattern, specifier);
      if (match === undefined) continue;
      for (const substitution of substitutions) {
        candidates.push(
          path.resolve(baseUrl, substitution.replace('*', match)),
        );
      }
    }
  }
  return candidates
    .map(normalizeRepositoryModulePath)
    .find(
      (target): target is string =>
        target !== undefined && forbiddenFacadeTargets.has(target),
    );
}

function resolvedRepositoryTarget(
  file: string,
  specifier: string,
  compilerOptions = compilerOptionsForFile(file),
) {
  const resolved = ts.resolveModuleName(
    specifier,
    file,
    compilerOptions,
    ts.sys,
  ).resolvedModule;
  const resolvedTarget =
    resolved && normalizeRepositoryModulePath(resolved.resolvedFileName);
  return (
    resolvedTarget ??
    unresolvedFacadeTarget(file, specifier, compilerOptions)
  );
}

function isForbiddenFacadeImport(
  file: string,
  specifier: string,
  compilerOptions = compilerOptionsForFile(file),
) {
  const resolvedTarget = resolvedRepositoryTarget(
    file,
    specifier,
    compilerOptions,
  );
  return (
    resolvedTarget !== undefined &&
    forbiddenFacadeTargets.has(resolvedTarget)
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

describe('repository module resolution', () => {
  const importer = path.join(
    projectRoot,
    'src/application/theme/importTheme.ts',
  );
  const aliasCompilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: projectRoot,
    paths: {
      '@ui/*': ['src/components/*'],
      '@app/*': ['src/application/*'],
      '@legacy-theme': [sourceTarget('src', 'domain', 'theme')],
    },
  };

  it('resolves an ordinary relative directory import to its TypeScript index module', () => {
    expect(
      resolvedRepositoryTarget(
        importer,
        '../../domain/theme/migrations',
        aliasCompilerOptions,
      ),
    ).toBe('src/domain/theme/migrations/index');
  });

  it.each([
    ['../../domain/theme/model.js', 'src/domain/theme/model'],
    [
      '../../components/preview/PhonePreview.jsx',
      'src/components/preview/PhonePreview',
    ],
    [
      sourceTarget('../..', 'domain', 'theme.mjs'),
      sourceTarget('src', 'domain', 'theme'),
    ],
    [
      sourceTarget('../..', 'domain', 'theme.cjs'),
      sourceTarget('src', 'domain', 'theme'),
    ],
  ])('normalizes the TypeScript target for %s', (specifier, expected) => {
    expect(
      resolvedRepositoryTarget(importer, specifier, aliasCompilerOptions),
    ).toBe(expected);
  });

  it('resolves configured path aliases into repository layers and deleted facades', () => {
    expect(
      resolvedRepositoryTarget(
        importer,
        '@ui/preview/PhonePreview',
        aliasCompilerOptions,
      ),
    ).toBe('src/components/preview/PhonePreview');
    expect(
      resolvedRepositoryTarget(
        importer,
        '@app/theme/importTheme',
        aliasCompilerOptions,
      ),
    ).toBe('src/application/theme/importTheme');
    expect(
      isForbiddenFacadeImport(
        importer,
        '@legacy-theme',
        aliasCompilerOptions,
      ),
    ).toBe(true);
  });

  it('does not classify an unrelated external package lookalike as a facade', () => {
    expect(
      isForbiddenFacadeImport(
        importer,
        sourceTarget('@vendor', 'domain', 'theme'),
        aliasCompilerOptions,
      ),
    ).toBe(false);
  });
});

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
    const violations = allFiles.flatMap((file) =>
      (importsByFile.get(file) ?? [])
        .filter((specifier) => isForbiddenFacadeImport(file, specifier))
        .map((specifier) => `${repositoryPath(file)} imports ${specifier}`),
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
